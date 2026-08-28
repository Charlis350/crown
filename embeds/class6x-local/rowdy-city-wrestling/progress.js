var __loadWithProgress = function __loadWithProgress(filesToLoad, progressListener, completionCallback) {
	var progressManager = {},
		interval;
	var __loadedFiles = {};

	var scriptsToLoad = Object.keys(filesToLoad).filter(url => url.indexOf('.js') > 0);
	
	var __loadFile = function __loadFile(url) {
		return new Promise(function (resolve, reject) {
			var request = new XMLHttpRequest();
			request.open('GET', url);
			request.responseType = 'blob';
			
			request.onload = function () {
				if (request.status === 200) {
					__loadedFiles[url] = request.response;
					resolve(request.response);
				} else reject();
			};
			
			request.onerror = function () {
				reject();
			};
			
			request.onprogress = function (event) {
				progressManager[url] = {
					loaded: event.loaded,
					total: filesToLoad[url].total
				};
			};
			
			request.send();
		});
	};

	var __loadFiles = function __loadFiles() {
		var urls = Object.keys(filesToLoad);
		var promises = urls.map(url => __loadFile(url));
		interval = setInterval(function () {
			var currentProgress = __getProgress() || 0;
			progressListener(currentProgress);
			if (currentProgress === 1 && Object.keys(progressManager).length === urls.length) clearInterval(interval);
		}, 50);
		return Promise.all(promises);
	};

	var __getProgress = function __getProgress() {
		var loaded = 0,
			total = 0;
		Object.keys(progressManager).forEach(function (url) {
			loaded += progressManager[url].loaded;
			total += progressManager[url].total;
		});
		return loaded / total;
	};

	var urlCreator = window.URL || window.webkitURL;

	var __prepareScripts = function __prepareScripts() {
		var scriptCount = scriptsToLoad.length;
		scriptsToLoad.forEach(url => {
			var script = document.createElement('script'),
			src = urlCreator.createObjectURL(__loadedFiles[url]);
			script.src = src;
			script.onload = function(){
				if(--scriptCount == 0)
				{
					completionCallback();
				}
			};
			document.body.appendChild(script);
		});
	};

	__loadFiles().then(__prepareScripts);
}