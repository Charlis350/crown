window.PokiSDK = window.PokiSDK || {
  init: function(){ return Promise.resolve(); },
  initWithVideoHB: function(){ return Promise.resolve(); },
  commercialBreak: function(){ return Promise.resolve(); },
  rewardedBreak: function(){ return Promise.resolve(false); },
  gameplayStart: function(){},
  gameplayStop: function(){},
  happyTime: function(){},
  setDebug: function(){},
  setDebugTouchOverlayController: function(){},
  captureError: function(){},
  customEvent: function(){},
  shareableURL: function(){ return Promise.resolve(location.href); }
};