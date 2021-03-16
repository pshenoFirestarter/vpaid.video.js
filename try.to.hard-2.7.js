var VpaidVideoPlayer = function() {

    this.slot_ = null;
    this.videoSlot_ = null;
    this.eventsCallbacks_ = {};
    this.attributes_ = {
        'companions' : '',
        'desiredBitrate' : 256,
        'duration' : 30,
        'expanded' : false,
        'height' : 200,
        'icons' : '',
        'linear' : true,
        'remainingTime' : 10,
        'skippableState' : false,
        'viewMode' : 'normal',
        'width' : 400,
        'volume' : 1.0
    };

    this.quartileEvents_ = [
        {event: 'AdVideoStart', value: 0},
        {event: 'AdVideoFirstQuartile', value: 25},
        {event: 'AdVideoMidpoint', value: 50},
        {event: 'AdVideoThirdQuartile', value: 75},
        {event: 'AdVideoComplete', value: 100}
    ];
    this.lastQuartileIndex_ = 0;
    this.parameters_ = {};
};

var _srcAd;

VpaidVideoPlayer.HTML_TEMPLATE = `<video
                            id="content_video" 
                            class="video-js vjs-default-skin"
                            controls
                            preload="auto"
                            poster="https://vjs.zencdn.net/v/oceans.png">
                            <source src="https://cstatic.weborama.fr/advertiser/3466/108/374/561/video.mp4" type="video/mp4"></source>
                            <p class="vjs-no-js">
                                To view this video please enable JavaScript, and consider upgrading to a
                                web browser that
                                <a href="https://videojs.com/html5-video-support/" target="_blank">
                                supports HTML5 video
                                </a>
                            </p>
                        </video>`


/**
 * VPAID defined init ad, initializes all attributes in the ad.  The ad will
 * not start until startAd is called.
 *
 * @param {number} width The ad width.
 * @param {number} height The ad heigth.
 * @param {string} viewMode The ad view mode.
 * @param {number} desiredBitrate The desired bitrate.
 * @param {Object} creativeData Data associated with the creative.
 * @param {Object} environmentVars Variables associated with the creative like
 *     the slot and video slot.
 */
VpaidVideoPlayer.prototype.initAd = function(
    width,
    height,
    viewMode,
    desiredBitrate,
    creativeData,
    environmentVars) {
    
    console.log(JSON.parse(creativeData['AdParameters']))

    // slot and videoSlot are passed as part of the environmentVars
    this.attributes_['width'] = width;
    this.attributes_['height'] = height;
    this.attributes_['viewMode'] = viewMode;
    this.attributes_['desiredBitrate'] = desiredBitrate;
    this.slot_ = environmentVars.slot;
    this.videoSlot_ = environmentVars.videoSlot;

    // Parse the incoming parameters.
    this.parameters_ = JSON.parse(creativeData['AdParameters']);

    console.log(this.parameters_)

    _srcAd = this.parameters_.mediaFiles[0].uri


    this.log('initAd ' + width + 'x' + height +
        ' ' + viewMode + ' ' + desiredBitrate);
    // this.renderSlot_();
    this.updateVideoSlot_(_srcAd);
    this.videoSlot_.addEventListener(
        'timeupdate',
        this.timeUpdateHandler_.bind(this),
        false);
    this.videoSlot_.addEventListener(
        'ended',
        this.stopAd.bind(this),
        false);
    this.callEvent_('AdLoaded');
};



VpaidVideoPlayer.prototype.overlayOnClick_ = function() {
    this.callEvent_('AdClickThru');
};
VpaidVideoPlayer.prototype.timeUpdateHandler_ = function() {
    if (this.lastQuartileIndex_ >= this.quartileEvents_.length) {
        return;
    }
    var percentPlayed =
        this.videoSlot_.currentTime * 100.0 / this.videoSlot_.duration;
    if (percentPlayed >= this.quartileEvents_[this.lastQuartileIndex_].value) {
        var lastQuartileEvent = this.quartileEvents_[this.lastQuartileIndex_].event;
        this.eventsCallbacks_[lastQuartileEvent]();
        this.lastQuartileIndex_ += 1;
    }
};
VpaidVideoPlayer.prototype.updateVideoSlot_ = function(val) {
    if (this.videoSlot_ == null) {
        this.videoSlot_ = document.createElement('video');
        this.log('Warning: No video element passed to ad, creating element.');
        this.slot_.appendChild(this.videoSlot_);
    }
    this.updateVideoPlayerSize_();

    var foundSource = true;
    this.videoSlot_.setAttribute('src', val);

    // foundSource = false;
    // var videos = this.parameters_.videos || [];
    // for (var i = 0; i < videos.length; i++) {
    //     // Choose the first video with a supported mimetype.
    //     if (this.videoSlot_.canPlayType(videos[i].mimetype) != '') {
    //         this.videoSlot_.setAttribute('src', videos[i].url);
    //         foundSource = true;
    //         break;
    //     }
    // }


    if (!foundSource) {
        // Unable to find a source video.
        this.callEvent_('AdError');
    }
};
VpaidVideoPlayer.prototype.updateVideoPlayerSize_ = function() {
    this.videoSlot_.setAttribute('width', this.attributes_['width']);
    this.videoSlot_.setAttribute('height', this.attributes_['height']);
};
VpaidVideoPlayer.prototype.handshakeVersion = function(version) {
    return ('2.0');
};
VpaidVideoPlayer.prototype.startAd = function() {
    this.log('Starting ad');
    this.videoSlot_.play();
    var img = document.createElement('img');
    img.src = this.parameters_.overlay || '';
    this.slot_.appendChild(img);
    img.addEventListener('click', this.overlayOnClick_.bind(this), false);

    //add a test mute button
    var muteButton = document.createElement('input');
    muteButton.setAttribute('type', 'button');
    muteButton.setAttribute('value', 'mute/unMute');

    muteButton.addEventListener('click',
        this.muteButtonOnClick_.bind(this),
        false);
    this.slot_.appendChild(muteButton);

    this.callEvent_('AdStarted');
};
VpaidVideoPlayer.prototype.stopAd = function() {
    this.log('Stopping ad');
    // Calling AdStopped immediately terminates the ad. Setting a timeout allows
    // events to go through.
    var callback = this.callEvent_.bind(this);
    setTimeout(callback, 75, ['AdStopped']);
};
VpaidVideoPlayer.prototype.setAdVolume = function(value) {
    this.attributes_['volume'] = value;
    this.log('setAdVolume ' + value);
    this.callEvent_('AdVolumeChange');
};
VpaidVideoPlayer.prototype.getAdVolume = function() {
    this.log('getAdVolume');
    return this.attributes_['volume'];
};
VpaidVideoPlayer.prototype.renderSlot_ = function() {
    var slotExists = this.slot_ && this.slot_.tagName === 'DIV';
    if (!slotExists) {
        this.slot_ = document.createElement('div');
        if (!document.body) {
            document.body = /**@type {HTMLDocument}*/ document.createElement('body');
        }
        document.body.appendChild(this.slot_);
    }
    this.slot_.innerHTML = VpaidVideoPlayer.HTML_TEMPLATE;
};
/**
 * @param {number} width The new width.
 * @param {number} height A new height.
 * @param {string} viewMode A new view mode.
 */
VpaidVideoPlayer.prototype.resizeAd = function(width, height, viewMode) {
    this.log('resizeAd ' + width + 'x' + height + ' ' + viewMode);
    this.attributes_['width'] = width;
    this.attributes_['height'] = height;
    this.attributes_['viewMode'] = viewMode;
    this.updateVideoPlayerSize_();
    this.callEvent_('AdSizeChange');
};
VpaidVideoPlayer.prototype.pauseAd = function() {
    this.log('pauseAd');
    this.videoSlot_.pause();
    this.callEvent_('AdPaused');
};
VpaidVideoPlayer.prototype.resumeAd = function() {
    this.log('resumeAd');
    this.videoSlot_.play();
    this.callEvent_('AdResumed');
};
VpaidVideoPlayer.prototype.expandAd = function() {
    this.log('expandAd');
    this.attributes_['expanded'] = true;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    }
    this.callEvent_('AdExpanded');
};
VpaidVideoPlayer.prototype.getAdExpanded = function() {
    this.log('getAdExpanded');
    return this.attributes_['expanded'];
};
VpaidVideoPlayer.prototype.getAdSkippableState = function() {
    this.log('getAdSkippableState');
    return this.attributes_['skippableState'];
};
VpaidVideoPlayer.prototype.collapseAd = function() {
    this.log('collapseAd');
    this.attributes_['expanded'] = false;
};
VpaidVideoPlayer.prototype.skipAd = function() {
    this.log('skipAd');
    var skippableState = this.attributes_['skippableState'];
    if (skippableState) {
        this.callEvent_('AdSkipped');
    }
};
/**
 * Registers a callback for an event.
 * @param {Function} aCallback The callback function.
 * @param {string} eventName The callback type.
 * @param {Object} aContext The context for the callback.
 */

VpaidVideoPlayer.prototype.subscribe = function(
    aCallback,
    eventName,
    aContext) {
    this.log('Subscribe ' + aCallback);
    var callBack = aCallback.bind(aContext);
    this.eventsCallbacks_[eventName] = callBack;
};
VpaidVideoPlayer.prototype.unsubscribe = function(eventName) {
    this.log('unsubscribe ' + eventName);
    this.eventsCallbacks_[eventName] = null;
};
VpaidVideoPlayer.prototype.getAdWidth = function() {
    return this.attributes_['width'];
};
VpaidVideoPlayer.prototype.getAdHeight = function() {
    return this.attributes_['height'];
};
VpaidVideoPlayer.prototype.getAdRemainingTime = function() {
    return this.attributes_['remainingTime'];
};
VpaidVideoPlayer.prototype.getAdDuration = function() {
    return this.attributes_['duration'];
};
VpaidVideoPlayer.prototype.getAdCompanions = function() {
    return this.attributes_['companions'];
};
VpaidVideoPlayer.prototype.getAdIcons = function() {
    return this.attributes_['icons'];
};
VpaidVideoPlayer.prototype.getAdLinear = function() {
    return this.attributes_['linear'];
};
VpaidVideoPlayer.prototype.log = function(message) {
    console.log(message);
};
VpaidVideoPlayer.prototype.callEvent_ = function(eventType) {
    if (eventType in this.eventsCallbacks_) {
        this.eventsCallbacks_[eventType]();
    }
};
VpaidVideoPlayer.prototype.muteButtonOnClick_ = function() {
    if (this.attributes_['volume'] == 0) {
        this.attributes_['volume'] = 1.0;
    } else {
        this.attributes_['volume'] = 0.0;
    }
    this.callEvent_('AdVolumeChange');
};

var getVPAIDAd = function() {
    return new VpaidVideoPlayer();
};

console.log(getVPAIDAd)
