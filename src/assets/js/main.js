const storage = chrome.storage || browser.storage;
const Notify = new Notifier("TopRight");

let currency = "usd";

let currencySymbols = {
	usd: "$",
	gbp: "£",
	eur: "€",
	chf: "Fr ",
	aud: "$",
	jpy: "¥",
	cad: "$"
};

(async () => {
	let theme = "dark";
	let view = "full";

	let data = await getStorage();

	console.log(data);

	if("theme" in data && ["light", "dark"].includes(data.theme)) {
		theme = data.theme;
	}

	setTheme(theme);

	if("view" in data && ["full", "compact"].includes(data.view)) {
		view = data.view;
	}

	setView(view);

	listCoins(true);
})();

let divCoinList = document.getElementById("coin-list"); 

let inputCoin = document.getElementById("input-coin");

let buttonRemoveCoin = document.getElementById("remove-coin-button");
let buttonAddCoin = document.getElementById("add-coin-button");

let toggleTheme = document.getElementById("toggle-theme");
let toggleView = document.getElementById("toggle-view");

buttonRemoveCoin.addEventListener("click", async () => {
	let symbol = inputCoin.value;

	if(!empty(symbol)) {
		let coin = await getCoin({ symbol:symbol });
		let data = await getStorage();

		if(!empty(coin) && "id" in coin) {
			let coinList = data.coinList || [];
			
			if(coinList.includes(coin.id)) {
				coinList.splice(coinList.indexOf(coin.id), 1);
			}

			await setStorage({ coinList:coinList });

			listCoins(true);
		}
	}
});

buttonAddCoin.addEventListener("click", async () => {
	let symbol = inputCoin.value;

	if(!empty(symbol)) {
		let coin = await getCoin({ symbol:symbol });
		let data = await getStorage();

		if(!empty(coin) && "id" in coin) {
			let coinList = data.coinList || [];
			coinList.push(coin.id);

			await setStorage({ coinList:coinList });

			listCoins(true);
		}
	}
});

toggleTheme.addEventListener("click", () => {
	if(toggleTheme.classList.contains("active")) {
		setTheme("dark");
	} else {
		setTheme("light");
	}
});

toggleView.addEventListener("click", () => {
	if(toggleView.classList.contains("active")) {
		setView("full");
	} else {
		setView("compact");
	}
});

async function listCoins(emptyList) {
	let data = await getStorage();

	if(emptyList) {
		divCoinList.innerHTML = "";
	}

	if("coinList" in data && !empty(data.coinList) && data.coinList.length >= 1) {
		let ids = data.coinList.join("%2C");

		console.log("Coin List: ", ids);

		let coins = await getCoinMarketData(ids, currency);

		console.log(coins);

		let keys = Object.keys(coins);

		keys.map(key => {
			let coin = coins[key];
			let price = parseFloat(coin.current_price);
	
			if(price > 1) {
				price = separateThousands(price);
			}
	
			let id = "crypto-ticker-" + coin.id;
	
			let marketCap = coin.market_cap;
	
			let name = coin.name;
			let icon = coin.image;
			let priceChangeDay = coin.price_change_percentage_24h;
	
			if(!empty(priceChangeDay)) {
				priceChangeDay = priceChangeDay.toFixed(2).includes("-") ? priceChangeDay.toFixed(2) : "+" + priceChangeDay.toFixed(2);
			} else {
				priceChangeDay = "-";
			}
	
			let symbol = coin.symbol;
	
			let div = createCoinCard(id, coin, symbol, price, name, icon, priceChangeDay);

			divCoinList.appendChild(div);

			console.log(name, price);
		});
	}
}

function createCoinCard(id, coin, symbol, price, name, icon, priceChangeDay) {
	let div = document.createElement("div");
	div.id = id;
	div.setAttribute("class", "coin-wrapper noselect");

	div.innerHTML = `<div class="row"><img src="${icon}"><span class="name">${name}</span></div><div class="row colored"><span class="price">${currencySymbols[currency] + price}</span><span class="change">${priceChangeDay}</span></div>`;

	return div;
}

async function setTheme(theme) {
	if(theme === "light") {
		toggleTheme.classList.add("active");

		await setStorage({ theme:"light" });

		document.documentElement.classList.remove("dark");
		document.documentElement.classList.add("light");
	} else {
		toggleTheme.classList.remove("active");

		await setStorage({ theme:"dark" });

		document.documentElement.classList.remove("light");
		document.documentElement.classList.add("dark");
	}
}

async function setView(view) {
	if(view === "compact") {
		toggleView.classList.add("active");

		await setStorage({ view:"compact" });

		document.documentElement.classList.remove("full");
		document.documentElement.classList.add("compact");
	} else {
		toggleView.classList.remove("active");

		await setStorage({ view:"full" });

		document.documentElement.classList.remove("compact");
		document.documentElement.classList.add("full");
	}
}

function showLoading(limit, text = "") {
	hideLoading();

	let element = document.createElement("div");
	element.classList.add("loading-screen");
	element.innerHTML = '<div class="loading-icon"><div></div><div></div></div><span id="loading-text">' + text + '</span>';
	document.body.appendChild(element);

	setTimeout(() => {
		element.remove();
	}, limit);
}

function hideLoading() {
	for(let i = 0; i < document.getElementsByClassName("loading-screen").length; i++) {
		document.getElementsByClassName("loading-screen")[i].remove();
	}
}

function getStorage(name) {
	return new Promise(function(resolve, reject) {
		storage.local.get(name, (result) => {
			resolve(result);
		});
	});
}

function setStorage(data) {
	return new Promise(function(resolve, reject) {
		storage.local.set(data, () => {
			resolve();
		});
	});
}

function getCoin(args) {
	return new Promise((resolve, reject) => {
		fetchCoins().then(coins => {
			let coin;

			if((empty(args.id) && empty(args.symbol)) || (!empty(args.id) && !empty(args.symbol))) {
				return;
			} else if(!empty(args.symbol)) {
				coin = findBySymbol(coins, args.symbol, true);
			} else if(!empty(args.id)) {
				coin = findByID(coins, args.id, true);
			}

			if("matches" in coin && coin.matches.length > 1) {
				Notify.error({
					width: "220px",
					title: "Error",
					description: "Two or more coins have the same symbol. Try using the CoinGecko ID of the coin or its full name.",
				});
			}

			resolve(coin);
		}).catch(error => {
			console.log(error);
			reject(error);
		});
	});
}

function getCoinMarketData(ids, currency) {
	return new Promise((resolve, reject) => {
		try {
			console.log("Fetching Market Data...");

			let xhr = new XMLHttpRequest();

			xhr.addEventListener("readystatechange", () => {
				if(xhr.readyState === XMLHttpRequest.DONE) {
					if(validJSON(xhr.responseText)) {
						resolve(JSON.parse(xhr.responseText));
					} else {
						reject("Invalid JSON.");
					}
				}
			});

			xhr.open("GET", "https://api.coingecko.com/api/v3/coins/markets?vs_currency=" + currency + "&ids=" + ids + "&order=market_cap_desc&per_page=250&page=1&sparkline=false", true);
			xhr.send();
		} catch(e) {
			reject(e);
		}
	});
}

async function fetchCoins() {
	return new Promise(async (resolve, reject) => {
		let data = getStorage();

		if(empty(data.coins) || (Math.floor(new Date().getTime() / 1000)) - 3600 > parseInt(data.fetchedCoins)) {
			console.log("Fetching Coins...");

			let pairs = [];

			let endpoint = "https://api.coingecko.com/api/v3/coins/list"

			fetch(endpoint, {
				method: "GET",
				headers: {
					Accept: "application/json", "Content-Type": "application/json"
				}
			})
			.then((json) => {
				return json.json();
			})
			.then(async (coins) => {
				Object.keys(coins).map(coin => {
					let symbol = coins[coin].symbol.toLowerCase();
					let pair = { [symbol]:coins[coin].id };
					pairs.push(pair);
				});

				setStorage({ coins:pairs, fetchedCoins:(Math.floor(new Date().getTime() / 1000)) });

				resolve(pairs);
			}).catch(error => {
				console.log(error);
				reject(error);
			});
		} else {
			resolve(data.coins);
		}
	});
}

function findBySymbol(coins, symbol, retry) {
	let matches = [];

	coins.map(coin => {
		if(Object.keys(coin)[0] === symbol) {
			matches.push(coin);
		}
	});

	if(matches.length === 1) {
		return { id:matches[0][symbol], symbol:symbol };
	} else if(empty(matches)) {
		if(retry) {
			return findByID(coins, symbol, false);
		} else {
			return { error:"No coins were found with that symbol." };
		}
	} else {
		return { matches:matches };
	}
}

function findByID(coins, id, retry) {
	let values = Object.values(coins);
	let symbols = {};
	let ids = [];

	values.map(value => {
		ids.push(value[Object.keys(value)[0]]);
		symbols[value[Object.keys(value)[0]]] = Object.keys(value)[0];
	});

	if(ids.includes(id)) {
		return { id:id, symbol:symbols[id] };
	} else {
		if(retry) {
			return findBySymbol(coins, id, false);
		} else {
			return { error:"No coins were found with that symbol." };
		}
	}
}

function request(method, url, body) {
	return new Promise((resolve, reject) => {
		try {
			let xhr = new XMLHttpRequest();

			xhr.addEventListener("readystatechange", () => {
				if(xhr.readyState === xhr.DONE) {
					if(validJSON(xhr.responseText)) {
						let response = JSON.parse(xhr.responseText);
						resolve(response);
					} else {
						if(empty(xhr.responseText)) {
							reject("Server error.");
						} else {
							reject("Invalid JSON.");
						}
					}
				}
			});

			xhr.addEventListener("error", (error) => {
				reject(error);
			});

			xhr.open(method, url, true);
			xhr.setRequestHeader("Content-Type", "application/json");
			xhr.send(JSON.stringify(body));
		} catch(error) {
			console.log(error);
			reject(error);
		}
	});
}

function separateThousands(number) {
	let parts = number.toString().split(".");
	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return parts.join(".");
}

function abbreviateNumber(num, digits) {
	let si = [
		{ value: 1, symbol: "" },
		{ value: 1E3, symbol: "k" },
		{ value: 1E6, symbol: "M" },
		{ value: 1E9, symbol: "B" },
		{ value: 1E12, symbol: "T" },
		{ value: 1E15, symbol: "P" },
		{ value: 1E18, symbol: "E" }
	];
	let rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
	let i;
	for(i = si.length - 1; i > 0; i--) {
		if(num >= si[i].value) {
			break;
		}
	}
	return (num / si[i].value).toFixed(digits).replace(rx, "$1") + si[i].symbol;
}

function validJSON(json) {
	try {
		let object = JSON.parse(json);
		if(object && typeof object === "object") {
			return true;
		}
	}
	catch(e) { }
	return false;
}

function empty(value) {
	if(typeof value === "object" && value !== null && Object.keys(value).length === 0) {
		return true;
	}
	if(value === null || typeof value === "undefined" || value.toString().trim() === "") {
		return true;
	}
	return false;
}