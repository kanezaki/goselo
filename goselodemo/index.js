let utils = new Utils('message');
let messages = [];

var imageLoaded = false, cvLoaded = false, runnerLoaded = false;
var state;
var worker;

var imMap, theMap, theMapExtend, origMap;
var xA, yA, xB, yB;
var im30, im31, im32, im33, im34, im35;
var routeFinal;

//画像を配列に格納する

var img = new Array();
img[0] = new Image();
img[0].src = './map_images/AR0011SR.png';
img[1] = new Image();
img[1].src = './map_images/AR0205SR.png';
img[2] = new Image();
img[2].src=  './map_images/AR0411SR.png';
img[3] = new Image();
img[3].src=  './map_images/lak303d.png';
img[4] = new Image();
img[4].src=  './map_images/lak308d.png';
var mapID = 0;

// UI のアップデート

let updateUI = () => {
    if (state == 'loading') {
//        document.getElementById('fileInput').disabled = true;
        document.getElementById('mapButton').disabled = true;
        document.getElementById('loadButton').disabled = true;
//        document.getElementById('nextStepButton').disabled = true;
        document.getElementById('playButton').disabled = true;
        document.getElementById('stopButton').disabled = true;
    } else if (state == 'ready') {
//        document.getElementById('fileInput').disabled = false;
        document.getElementById('mapButton').disabled = false;
        document.getElementById('loadButton').disabled = false;
//        document.getElementById('nextStepButton').disabled = true;
        document.getElementById('playButton').disabled = true;
        document.getElementById('stopButton').disabled = true;
    } else if (state == 'workerLoading') {
//        document.getElementById('fileInput').disabled = true;
        document.getElementById('mapButton').disabled = true;
        document.getElementById('loadButton').disabled = true;
//        document.getElementById('nextStepButton').disabled = true;
        document.getElementById('playButton').disabled = true;
        document.getElementById('stopButton').disabled = true;
    } else if (state == 'workerStopped') {
//        document.getElementById('fileInput').disabled = false;
        document.getElementById('mapButton').disabled = false;
        document.getElementById('loadButton').disabled = false;
//        document.getElementById('nextStepButton').disabled = false;
        document.getElementById('playButton').disabled = false;
        document.getElementById('stopButton').disabled = true;
    } else if (state == 'workerOncePlaying') {
//        document.getElementById('fileInput').disabled = false;
        document.getElementById('mapButton').disabled = false;
        document.getElementById('loadButton').disabled = false;
//        document.getElementById('nextStepButton').disabled = true;
        document.getElementById('playButton').disabled = true;
        document.getElementById('stopButton').disabled = false;
    } else if (state == 'workerPlaying') {
//        document.getElementById('fileInput').disabled = false;
        document.getElementById('mapButton').disabled = false;
        document.getElementById('loadButton').disabled = false;
//        document.getElementById('nextStepButton').disabled = true;
        document.getElementById('playButton').disabled = true;
        document.getElementById('stopButton').disabled = false;
    }
};

// WebWorker インスタンスの生成

let createWorkerIfNeeded = async () => {
    if (worker != undefined) {
        return;
    }

    worker = new Worker('worker.js');
    worker.onmessage = async (e) => {
        console.log(`index.js onmessage: ${e.data.action}`);

        if (state == 'workerLoading' && e.data.action == 'load') {
            if (theMap != undefined) theMap.delete();
            if (theMapExtend != undefined) theMapExtend.delete();
            if (origMap != undefined) origMap.delete();
            theMap = deserializeMat(e.data.theMap);
            theMapExtend = deserializeMat(e.data.theMapExtend);
            origMap = deserializeMat(e.data.origMap);
            xA = e.data.xA;
            yA = e.data.yA;
            xB = e.data.xB;
            yB = e.data.yB;
            
            await onWorkerLoad();

            state = 'workerStopped';
            updateUI();
        } else if ((state == 'workerOncePlaying' || state == 'workerPlaying') && e.data.action == 'nextStep') {
            if (im30 != undefined) im30.delete();
            if (im31 != undefined) im31.delete();
            if (im32 != undefined) im32.delete();
            if (im33 != undefined) im33.delete();
            if (im34 != undefined) im34.delete();
            if (im35 != undefined) im35.delete();
            im30 = deserializeMat(e.data.im30);
            im31 = deserializeMat(e.data.im31);
            im32 = deserializeMat(e.data.im32);
            im33 = deserializeMat(e.data.im33);
            im34 = deserializeMat(e.data.im34);
            im35 = deserializeMat(e.data.im35);
            theta = e.data.theta;

            await onWorkerNextStep();

            // 再生中なら繰り返し実行する。
            if (state == 'workerPlaying') {
                if (await runNextStep()) {
                    state = 'workerStopped';
                    updateUI();
                }
            } else {
                state = 'workerStopped';
                updateUI();
            }
	    // update image
	    // (() => {
	    // 	let t = im30.clone();
	    // 	cvFilterMat(t, t, (p) => p >= 1, (p) => 255, (p) => p);
	    // 	cv.imshow('im30Output', t);
	    // 	t.delete();
	    // })();
	    // (() => {
	    // 	let t = im31.clone();
	    // 	cvFilterMat(t, t, (p) => p >= 1, (p) => 255, (p) => p);
	    // 	cv.imshow('im31Output', t);
	    // 	t.delete();
	    // })();
	    (() => {
		imMap.ucharPtr( yA, xA )[ 0 ] = 0; imMap.ucharPtr( yA, xA )[ 1 ] = 255; imMap.ucharPtr( yA, xA )[ 2 ] = 0;
		let t = imMap.clone();
		cv.circle(t, new cv.Point(xA, yA), 3, new cv.Scalar(255, 0, 0, 255), -1);
		cv.circle(t, new cv.Point(xB, yB), 3, new cv.Scalar(0, 0, 255, 255), -1);
		cv.circle(t, new cv.Point(xB, yB), 7, new cv.Scalar(0, 255, 0, 255), 2);
		cv.imshow('imMapOutput', t);
		t.delete();
	    })();
        }
    };
};

// ワーカー実行中ならワーカーを強制終了

let terminateWorkerIfNeeded = () => {
    let needed = worker != undefined &&
        (state == 'workerLoading' || state == 'workerOncePlaying' || state == 'workerPlaying');
};

// マップのロード処理を Worker で実行

let runLoad = async () => {
    routeFinal = [];

    if (imMap != undefined) imMap.delete();
    imMap = cv.imread('canvasInput');

    await createWorkerIfNeeded();
    worker.postMessage({
        action: 'load',
        // theMap = imMap
        theMap: serializeMat(imMap)
    });
};

// DNN 前処理を Worker で実行

let runNextStep = async () => {
    // break if the agent is inside an obstacle
    if (theMap.ucharPtr(yA, xA)[0] == 1) {
        printMessage('The agent is inside an obstacle');
        return true;
    }
    // break if reached goal
    if (Math.abs(xA - xB) < 2 && Math.abs(yA - yB) < 2) {
        printMessage('The agent reached goal 🎉');
        return true;
    }
    origMap.ucharPtr(yA, xA)[1] += 1;

    await createWorkerIfNeeded();
    worker.postMessage({
        action: 'nextStep',
        origMap: serializeMat(origMap),
        xA: xA,
        yA: yA,
        xB: xB,
        yB: yB
    });

    return false;
};

// Worker 側のロード処理完了ハンドラ
// スタート地点とゴール地点を imMap として表示

let onWorkerLoad = async () => {
    (() => {
        let t = imMap.clone();
        cv.circle(t, new cv.Point(xA, yA), 3, new cv.Scalar(255, 0, 0, 255), -1);
        cv.circle(t, new cv.Point(xB, yB), 3, new cv.Scalar(0, 0, 255, 255), -1);
	cv.circle(t, new cv.Point(xB, yB), 7, new cv.Scalar(0, 255, 0, 255), 2);
        cv.imshow('imMapOutput', t);
        t.delete();
    })();
    printMessage(`sx, sy = ${xA}, ${yA}`);
    printMessage(`gx, gy = ${xB}, ${yB}`);
};

// Worker 側の DNN 前処理完了ハンドラ
// WebDNN を実行し、次の移動先を決める。また、6ch 画像を im30, im31 として表示

let onWorkerNextStep = async () => {
    let nDirs = 8; // number of possible directions to move on the map
    let dx = [1, 1, 0, -1, -1, -1, 0, 1];
    let dy = [0, 1, 1, 1, 0, -1, -1, -1];
    let avoidRelativeDirs = [1, 7, 2, 6, 3, 5, 4];

    // CNN classification
    // Web DNN の実行はメインスレッド側
    var dirDst, route;
    await (async () => {
        let input = runner.inputs[0], output = runner.outputs[0];
        let inputArray = new Float32Array(im30.data.length + im31.data.length + im32.data.length + im33.data.length + im34.data.length + im35.data.length);

        //inputArray.set(im30.data, 0);
        //inputArray.set(im31.data, im30.data.length);
	console.log(`index.js onmessage: forloop...`);
        //cvCopyIm30Im31ToInputArray(im30, im31, inputArray);
        inputArray.set(im30.data, 0);
        inputArray.set(im31.data, im30.data.length*1);
        inputArray.set(im32.data, im30.data.length*2);
        inputArray.set(im33.data, im30.data.length*3);
        inputArray.set(im34.data, im30.data.length*4);
        inputArray.set(im35.data, im30.data.length*5);
	console.log(`index.js onmessage: forloop... done!`);

        input.set(inputArray);
	console.log(`index.js onmessage: await runner...`);
        await runner.run();
	console.log(`index.js onmessage: await runner... done!`);
//	printMessage(`${output}`)
        let predictions = Array.from(output);
        var maxValue, dirSrc;
        for (var i=0;i<predictions.length;i++) {
            if (maxValue == undefined || predictions[i] > maxValue) {
                maxValue = predictions[i];
                dirSrc = i;
            }
        }
//        printMessage(`dirSrc = ${dirSrc}`);
        var angle = 360 - 45 * dirSrc - theta - 90
        while (angle < 0) {
            angle += 360;
        }
        dirDst = 8 - Math.floor(Math.round((angle % 360) / 45.));
        if (dirDst == 8) {
            dirDst = 0;
        }
        route = [dirDst];
//        printMessage(`route = ${route}`);
    })();

    // force avoidance (change direction if it is invalid)
    var freeSpace = nDirs;
    for (let d=0;d<nDirs;d++) {
        if (theMapExtend.ucharPtr(yA + dy[d], xA + dx[d])[0] == 1) {
            freeSpace -= 1;
        }
    }
    let xA_ = xA + dx[route[0]];
    let yA_ = yA + dy[route[0]];
    if (freeSpace > 0 &&
            theMapExtend.ucharPtr(yA + dy[route[0]], xA + dx[route[0]])[0] == 1 &&
            (Math.abs(xA_ - xB) > 3 || Math.abs(yA_ - yB) > 3)) {
        let candDirs = new Array(avoidRelativeDirs.length);
        for (var c=0;c<avoidRelativeDirs.length;c++) {
            candDirs[c] = avoidRelativeDirs[c] + dirDst;
            if (candDirs[c] >= nDirs) {
                candDirs[c] -= nDirs;
            }
        }
        // route = [ cand_dirs[ np.argmin( num_passed ) ] ]
        var minValue = undefined;
        for (var cd of candDirs) {
            if (theMapExtend.ucharPtr(yA + dy[cd], xA + dx[cd])[0] != 1) {
                let value = origMap.ucharPtr(yA + dy[cd], xA + dx[cd])[1];
                if (minValue == undefined || value < minValue) {
                    minValue = value;
                    route = [cd];
                }
            }
        }
//        printMessage(`object avoidance! route = ${route}`);
    }

    // one step forward
    xA += dx[route[0]];
    yA += dy[route[0]];
    routeFinal.push(route[0]);

    printMessage(`x, y = ${xA}, ${yA}`);
};

// ボタンハンドラ

document.getElementById('mapButton').addEventListener('click', (el, ev) => {
    terminateWorkerIfNeeded();

    mapID++;
    if (mapID == 5)
	mapID = 0;
    let filename = img[ mapID ].src;
    utils.loadImageToCanvas(filename, 'canvasInput', () => {
	imageLoaded = true;
	//    printMessage('CanvasInput is ready!');
	if (imageLoaded && cvLoaded && runnerLoaded) { onReady(); }
    });
    
    updateUI();
});
document.getElementById('loadButton').addEventListener('click', (el, ev) => {
    terminateWorkerIfNeeded();

    runLoad();
    
    state = 'workerLoading';
    updateUI();
});
// document.getElementById('nextStepButton').addEventListener('click', async (el, ev) => {
//     state = 'workerOncePlaying';
//     updateUI();
    
//     if (await runNextStep()) {
//         state = 'workerStopped';
//         updateUI();
//     }
// });
document.getElementById('playButton').addEventListener('click', async (el, ev) => {
    state = 'workerPlaying';
    updateUI();
    
    if (await runNextStep()) {
        state = 'workerStopped';
        updateUI();
    }
});
document.getElementById('stopButton').addEventListener('click', async (el, ev) => {
    terminateWorkerIfNeeded();

    state = 'workerStopped';
    updateUI();
});

// ユーティリティ

let printMessage = (message) => {
    messages.unshift(message);
    document.getElementById("message").innerHTML = messages.join("<br>");
};

// ライブラリのロードと UI の初期化

let onReady = async () => {
    state = 'ready';
    updateUI();
};

utils.loadImageToCanvas(img[mapID].src, 'canvasInput', () => {
    imageLoaded = true;
//    printMessage('CanvasInput is ready!');
    if (imageLoaded && cvLoaded && runnerLoaded) { onReady(); }
});
// utils.addFileInputHandler('fileInput', 'canvasInput', () => {
//     terminateWorkerIfNeeded();

//     imageLoaded = true;
// //    printMessage('CanvasInput is ready!');
//     if (imageLoaded && cvLoaded && runnerLoaded) { onReady(); }
// });
utils.loadOpenCv(() => {
    cvLoaded = true;
//    printMessage('OpenCV.js is ready!');
    if (imageLoaded && cvLoaded && runnerLoaded) { onReady(); }
});
(async () => {
    runner = await WebDNN.load('./output', {backendOrder: ['webgpu', 'webassembly', 'fallback']});
    runnerLoaded = true;
    printMessage('WebDNN is ready!');
    if (imageLoaded && cvLoaded && runnerLoaded) { onReady(); }
})();

state = 'loading';
printMessage("Loading WebDNN ... (This may take several minutes.)")

updateUI();
