async function loadLinks() {
    let data = await chrome.storage.sync.get('links');
    if (data.links) {
        data.links.forEach(function(link, index) {
            var div = document.createElement('div');
            div.className = 'link-row';

            var p = document.createElement('p');
            p.innerText = link.name + ":";
            div.appendChild(p);

            var input = document.createElement('input');
            input.type = 'text';
            input.id = 'input' + index;
            div.appendChild(input);

            document.getElementById('linksContainer').appendChild(div);
        });
    }

    // Event listener for Enter keydown
    window.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            for (var i = 0; i < data.links.length; i++) {
                var input = document.getElementById('input' + i);
                if (input && input.value) {
                    var link = data.links[i].url + input.value;
                    chrome.tabs.create({url: link});
                }
            }
        }
    });

    document.getElementById('currentTab').onclick = function() {
        for (var i = 0; i < data.links.length; i++) {
            var input = document.getElementById('input' + i);
            if (input && input.value) {
                var link = data.links[i].url + input.value;
                chrome.tabs.update({url: link});
            }
        }
    }

    document.getElementById('newTab').onclick = function() {
        for (var i = 0; i < data.links.length; i++) {
            var input = document.getElementById('input' + i);
            if (input && input.value) {
                var link = data.links[i].url + input.value;
                chrome.tabs.create({url: link});
            }
        }
    }
}

loadLinks();

document.getElementById('options').onclick = function() {
    if (chrome.runtime.openOptionsPage) {
        // New way to open options pages, if supported (Chrome 42+).
        chrome.runtime.openOptionsPage();
    } else {
        // Reasonable fallback.
        window.open(chrome.runtime.getURL('options.html'));
    }
};

document.getElementById('close').onclick = function() {
    window.close();
}
