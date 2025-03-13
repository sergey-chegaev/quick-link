async function loadLinks() {
    let data = await chrome.storage.sync.get('links');
    if (data.links) {
        data.links.forEach(addLinkField);
    } else {
        let defaultLink = {name: "Link 1", url: "http://example.com"};
        await chrome.storage.sync.set({links: [defaultLink]});
        addLinkField(defaultLink);
    }
}

loadLinks();

// Add new link input field with a remove button
document.getElementById('addLink').onclick = function() {
    var newLink = {name: "", url: ""};
    addLinkField(newLink);
}

function addLinkField(link) {
    var div = document.createElement('div');
    div.className = 'link-row'

    var nameLabel = document.createElement('label');
    nameLabel.innerText = "Name:";
    div.appendChild(nameLabel);

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = link.name;
    nameInput.className = 'url-name';
    nameInput.onchange = function() {
        saveLinks();
    };
    div.appendChild(nameInput);

    var urlLabel = document.createElement('label');
    urlLabel.innerText = "URL:";
    div.appendChild(urlLabel);

    var urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.value = link.url;
    urlInput.className = 'url-input';
    urlInput.onchange = function() {
        saveLinks();
    };
    div.appendChild(urlInput);

    const removeButton = document.createElement('button');
    removeButton.className = 'remove';  // Apply the 'remove' class
    removeButton.innerText = "Remove";
    removeButton.onclick = function() {
        div.parentNode.removeChild(div);
        saveLinks();
    };
    div.appendChild(removeButton);

    document.getElementById('linksContainer').appendChild(div);
}

async function saveLinks() {
    var divs = document.getElementById('linksContainer').getElementsByTagName('div');
    var links = [];
    for (var i = 0; i < divs.length; i++) {
        var inputs = divs[i].getElementsByTagName('input');
        var link = {name: inputs[0].value, url: inputs[1].value};
        links.push(link);
    }
    await chrome.storage.sync.set({links: links});
}
