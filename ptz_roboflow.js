// CHANGE THE IP TO PTZ CAMERA IP ADDRESS
var address = "192.168.1.19"

// SET UP ROBOFLOW.JS AUTH VARIABLES
let publishable_key = "API";
let model = "obs-3";
let version = 20;

// AI CAMERA VARIABLES
var tracking_object = "Grab"
var stop_object = "Stop"
var audio_on = false
var camera_height = 1080
var camera_width = 1920

// TUNE ROBOFLOW.JS DETECTION VARIABLES (HIGHER THRESHOLD MEANS MORE ACCURATE)
let threshold = 0.45;
let overlap = 0.5;
let max_objects = 20;
let camera_moving = false

async function stop_camera() {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", "http://"+address+"/cgi-bin/ptzctrl.cgi?ptzcmd&ptzstop", true); // false for synchronous request
    xmlHttp.send();
}

async function track_object(percent_horizontal, percent_vertical) {
    var xmlHttp = new XMLHttpRequest();
    //console.log(percent_horizontal);
    //console.log(percent_vertical);
    if (percent_horizontal > 1.4) {
        console.log("PANNING RIGHT");
        xmlHttp.open("GET", "http://"+address+"/cgi-bin/ptzctrl.cgi?ptzcmd&right&5&5", true); // false for synchronous request
        xmlHttp.send();
    } else if (percent_horizontal < 0.6) {
        console.log("PANNING LEFT");
        xmlHttp.open("GET", "http://"+address+"/cgi-bin/ptzctrl.cgi?ptzcmd&left&5&5", true); // false for synchronous request
        xmlHttp.send();
    } else if (percent_vertical > 1.8) {
        console.log("PANNING DOWN");
        xmlHttp.open("GET", "http://"+address+"0/cgi-bin/ptzctrl.cgi?ptzcmd&down&5&5", true); // false for synchronous request
        xmlHttp.send();
    } else if (percent_vertical < 0.25) {
        console.log("PANNING UP");
        xmlHttp.open("GET", "http://"+address+"/cgi-bin/ptzctrl.cgi?ptzcmd&up&5&5", true); // false for synchronous request
        xmlHttp.send();
    }
}

$(function () {
    const video = $("video")[0];

    var cameraMode = "user"; // or "environment"

    const startVideoStreamPromise = navigator.mediaDevices
        .getUserMedia({
            audio: audio_on,
            video: {
                width: camera_width,
                height: camera_height,
                facingMode: cameraMode
            }
        })
        .then(function (stream) {

            return new Promise(function (resolve) {
                video.srcObject = stream;
                video.onloadeddata = function () {
                    video.play();
                    resolve();
                };
            });
        });
    
    console.log(publishable_key)
    console.log(model)
    console.log(version)
    
    var toLoad = {
        model: model,
        version: version
    };

    const loadModelPromise = new Promise(function (resolve, reject) {

        roboflow
            .auth({
                publishable_key: publishable_key
            })
            .load(toLoad)
            .then(function (m) {
                model = m;
                model.configure({
                    threshold: threshold,
                    overlap: overlap,
                    max_objects: max_objects
                });
                resolve();
            });
    });


    Promise.all([startVideoStreamPromise, loadModelPromise]).then(function () {
        $("body").removeClass("loading");
        resizeCanvas();
        detectFrame();
    });

    var canvas, ctx;
    const font = "16px sans-serif";

    function videoDimensions(video) {
        // Ratio of the video's intrisic dimensions
        var videoRatio = video.videoWidth / video.videoHeight;

        // The width and height of the video element
        var width = video.offsetWidth,
            height = video.offsetHeight;

        // The ratio of the element's width to its height
        var elementRatio = width / height;

        // If the video element is short and wide
        if (elementRatio > videoRatio) {
            width = height * videoRatio;
        } else {
            // It must be tall and thin, or exactly equal to the original ratio
            height = width / videoRatio;
        }

        return {
            width: width,
            height: height
        };
    }

    $(window).resize(function () {
        resizeCanvas();
    });

    const resizeCanvas = function () {
        $("canvas").remove();

        canvas = $("<canvas/>");

        ctx = canvas[0].getContext("2d");

        var dimensions = videoDimensions(video);

        console.log(
            video.videoWidth,
            video.videoHeight,
            video.offsetWidth,
            video.offsetHeight,
            dimensions
        );

        canvas[0].width = video.videoWidth;
        canvas[0].height = video.videoHeight;

        canvas.css({
            width: dimensions.width,
            height: dimensions.height,
            left: ($(window).width() - dimensions.width) / 2,
            top: ($(window).height() - dimensions.height) / 2
        });

        $("body").append(canvas);
    };

    const renderPredictions = function (predictions) {
        var dimensions = videoDimensions(video);

        var scale = 1;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        if (predictions.length == 0 && camera_moving == true) {
            console.log("PTZ STOPPED")
            camera_moving = false;
            var xmlHttp = new XMLHttpRequest();
            xmlHttp.open("GET", "http://"+address+"/cgi-bin/ptzctrl.cgi?ptzcmd&ptzstop", true); // false for synchronous request
            xmlHttp.send();
        } else if (predictions.length > 0) {
            camera_moving = true;
        }

        predictions.forEach(function (prediction) {
            
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;

            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            // Draw the bounding box.
            ctx.strokeStyle = prediction.color;
            ctx.lineWidth = 4;
            ctx.strokeRect(
                (x - width / 2) / scale,
                (y - height / 2) / scale,
                width / scale,
                height / scale
            );

            // Draw the label background.
            ctx.fillStyle = prediction.color;
            const textWidth = ctx.measureText(prediction.class).width;       

            const textHeight = parseInt(font, 10); // base 10
            ctx.fillRect(
                (x - width / 2) / scale,
                (y - height / 2) / scale,
                textWidth + 8,
                textHeight + 4
            );
        });

        predictions.forEach(function (prediction) {
            
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;

            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            // Draw the text last to ensure it's on top.
            ctx.font = font;
            ctx.textBaseline = "top";
            ctx.fillStyle = "#000000";
            ctx.fillText(
                prediction.class,
                (x - width / 2) / scale + 4,
                (y - height / 2) / scale + 1
            );
        });

        // FUNCTION FOR CONTROLLING OBS INTERACTIONS
        predictions.forEach(function (prediction) {
            
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;

            const box_width_plus_x = prediction.bbox.width + x;
            const box_height_plus_y = prediction.bbox.height + y;

            const width = (video.videoWidth/2);
            const height = (video.videoHeight/2);

            const percent_horizontal = (x/width);
            const percent_vertical = (y/height);

            if (prediction.class === stop_object) {
                stop_camera();
                console.log("STOPPING CAMERA");
            }

            if (prediction.class === tracking_object) {
                track_object(percent_horizontal, percent_vertical);
            }

        });
    };

    var prevTime;
    var pastFrameTimes = [];
    const detectFrame = function () {
        if (!model) return requestAnimationFrame(detectFrame);

        model
            .detect(video)
            .then(function (predictions) {
                requestAnimationFrame(detectFrame);
                renderPredictions(predictions);

                if (prevTime) {
                    pastFrameTimes.push(Date.now() - prevTime);
                    if (pastFrameTimes.length > 30) pastFrameTimes.shift();

                    var total = 0;
                    _.each(pastFrameTimes, function (t) {
                        total += t / 1000;
                    });

                    var fps = pastFrameTimes.length / total;
                    $("#fps").text(Math.round(fps));
                }
                prevTime = Date.now();
            })
            .catch(function (e) {
                console.log("CAUGHT", e);
                requestAnimationFrame(detectFrame);
            });
    };
});
