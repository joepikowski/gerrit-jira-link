/* Click on Extension Icon */

chrome.action.onClicked.addListener(async () => {
	const gerritHost = await getGerritHost();

	chrome.tabs.query({active: true, currentWindow: true}, tabs => {
		chrome.tabs.sendMessage(tabs[0].id, {
			type: 'toggleNativePopup',
			configured: !!gerritHost,
			host: gerritHost
		});
	});
});


/* Active Tab Change */

let previousActiveTabId = '';

chrome.tabs.onActivated.addListener(active => {
	if (previousActiveTabId){ notifyTabOfActiveTabChange(previousActiveTabId); }
	notifyTabOfActiveTabChange(active.tabId);
	previousActiveTabId = active.tabId;
});

function notifyTabOfActiveTabChange(tabId){
	chrome.tabs.sendMessage(tabId, {
		type: 'activeTabChange'
	});
}


/* Messages */

chrome.runtime.onMessage.addListener(handleMessage);

function handleMessage(message, sender, sendResponse){
	switch (message.type) {
		case 'tryGetChangesByJiraKey':
			tryGetChangesByJiraKey(message.jiraKey, sender.tab.id, sendResponse);
			break;
		case 'setListBadge':
			setListBadge(message.value, sender.tab.id);
			break;
		case 'setGerritHost':
			setGerritHost(message.host, sender.tab.id, sendResponse);
			break;
	}
	return true;
}

function purgeLocalChanges(tabId){
	chrome.tabs.sendMessage(tabId, {
		type: 'purgeLocalChanges'
	});
}


/* Gerrit */

async function tryGetChangesByJiraKey(jiraKey, tabId, sendResponse){
	const gerritHost = await getGerritHost();
	if (gerritHost) {
		try{
			await getChangesByJiraKey(jiraKey).then(sendResponse);
		}catch(err){
			sendResponse([]);
		}
	}else{
		setConfigNeededBadge(tabId);
		purgeLocalChanges(tabId);
	}
}

async function getChangesByJiraKey(jiraKey){
	const gerritHost = await getGerritHost();
	const response = await fetch(`https://${gerritHost}/a/changes/?q=tr:${jiraKey}&n=15`);
	const responseText = await response.text();
	const trimmedText = responseText.substring(4);
	const json = JSON.parse(trimmedText);
	return json;
}


/* Badge */

function setConfigNeededBadge(tabId){
	setBadge('?', tabId);
	setBadgeColor('rgb(254, 80, 0)', tabId);
}

function setListBadge(value, tabId){
	setBadge(value, tabId);
	setBadgeColor('rgb(0, 82, 204)', tabId);
}

function setBadge(value, tabId){
	chrome.action.setBadgeText({
		tabId: tabId,
		text: value ? value.toString() : ''
	});
}

function setBadgeColor(color, tabId){
	chrome.action.setBadgeBackgroundColor({
		tabId: tabId,
		color: color
	});
}


/* Local Storage */

async function setGerritHost(host, tabId, sendResponse){
	await chrome.storage.local.set({ gerritHost: host });
	sendResponse();
	setListBadge('', tabId);
}

async function getGerritHost(){
	const data = await chrome.storage.local.get(['gerritHost']);
	return data['gerritHost'];
}