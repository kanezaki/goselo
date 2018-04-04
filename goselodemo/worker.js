importScripts('lib/opencv.js');
importScripts('lib/opencv_helper.js');

// ロード処理
// マップからスタートとゴールを生成し、origMap を用意

let runLoad = (theMap) => {
    var theMapExtend, origMap;

    // スタート・ゴールの決定
    let m = theMap.rows, n = theMap.cols;
    var xA, yA, xB, yB;
    // im_map[ im_map > 100 ] = 255
    cvFilterMat(theMap, theMap, (p) => p > 100, (p) => 255, (p) => p);
    (() => {
        while (true) {
            xA = Math.floor(Math.random() * n);
            yA = Math.floor(Math.random() * m);
            xB = Math.floor(Math.random() * n);
            yB = Math.floor(Math.random() * m);
            if (theMap.ucharPtr(yA, xA)[0] > 100 && theMap.ucharPtr(yB, xB)[0] > 100) {
                break;
            }
        }
    })();

    // theMap, theMapExtend
    theMapExtend = new cv.Mat();
    (() => {
        let M = cv.Mat.ones(2, 2, cv.CV_8U);
        cv.erode(theMap, theMapExtend, M, new cv.Point(-1, -1), 1);
        cv.threshold(theMap, theMap, 100, 1, cv.THRESH_BINARY_INV); // 最終的には 0,1
        cv.threshold(theMapExtend, theMapExtend, 100, 1, cv.THRESH_BINARY_INV); // 最終的には 0,1
        M.delete();
        let mv1 = new cv.MatVector();
        let mv2 = new cv.MatVector();
        cv.split(theMap, mv1);
        cv.split(theMapExtend, mv2);
        theMap.delete();
        theMapExtend.delete();
        theMap = mv1.get(0);
        theMapExtend = mv2.get(0);
        mv1.delete();
        mv2.delete();
    })();
    
    // origMap
    origMap = new cv.Mat();
    (() => {
        let mv = new cv.MatVector();
        let zeros = cv.Mat.zeros(m, n, cv.CV_8U);
        mv.push_back(theMap);
        mv.push_back(zeros);
        cv.merge(mv, origMap);
        mv.delete();
        zeros.delete();
    })();
    
    return [theMap, theMapExtend, origMap, xA, yA, xB, yB];
};

// DNN 前処理
// マップの回転・スケール・トリミングを行い、6ch 画像を生成

let runNextStepW = async (origMap, xA, yA, xB, yB) => {
    var im2, im30, im31, im32, im33, im34, im35;

    // theta, L
    let m = origMap.rows, n = origMap.cols;
    let sx = xA; sy = yA; gx = xB; gy = yB;
    let mx = (sx + gx) / 2., my = (sy + gy) / 2.;
    let dx_ = Math.max(mx, n - mx), dy_ = Math.max(my, m - my);
    var theta, L;
    if (gx == sx) {
        if (gy > sy) { theta = 90; } else { theta = 270; }
    } else {
        theta = Math.atan((gy - sy) / (gx - sx)) * 180 / Math.PI;
        if (gx - sx < 0) { theta = theta + 180; }
    }
    L = Math.floor(Math.sqrt((gx - sx) * (gx - sx) + (gy - sy) * (gy - sy)));

    // im2
    // im2[ int(dy_-my):int(dy_-my)+orig_map.shape[ 0 ] , int(dx_-mx):int(dx_-mx)+orig_map.shape[ 1 ] ] = orig_map
    im2 = new cv.Mat();
    let s = new cv.Scalar(0, 0);
    cv.copyMakeBorder(origMap, im2, Math.floor(dy_ - my), dy_*2-Math.floor(dy_ - my)-m, Math.floor(dx_ - mx), dx_*2-Math.floor(dx_ - mx)-n, cv.BORDER_CONSTANT, s);

//    // im2[ im2 == 1 ] = 2
//    cvFilterMat(im2, im2, (p) => p > 0, (p) => p * 2, (p) => p);
    (() => {
        // im2 = scipy.ndimage.interpolation.rotate( im2, 90+theta )
        let center = new cv.Point(im2.cols * 0.5, im2.rows * 0.5);
        let M = cv.getRotationMatrix2D(center, theta + 90, 1.);
        let rotatedRect = new cv.RotatedRect(center, new cv.Size(im2.cols, im2.rows), theta + 90);
        let boundingRect = cv.RotatedRect.boundingRect(rotatedRect);
        M.doublePtr(0, 2)[0] += boundingRect.width * 0.5 - center.x;
        M.doublePtr(1, 2)[0] += boundingRect.height * 0.5 - center.y;
        cv.warpAffine(im2, im2, M, new cv.Size(boundingRect.width, boundingRect.height), flags=cv.INTER_LINEAR);
        M.delete();
    })();
    
    // im30, im31
    let targetSize = [224, 224]
    let LS = [L + 4, 4 * L, 8 * L];
    im30 = new cv.Mat();
    im31 = new cv.Mat();
    im32 = new cv.Mat();
    im33 = new cv.Mat();
    im34 = new cv.Mat();
    im35 = new cv.Mat();
    let idx = 0;
    for (var i=0;i<im2.channels();i++) {
        let mv1 = new cv.MatVector();
        //let mv2 = new cv.MatVector();
        cv.split(im2, mv1);
        for (var j=0;j<3;j++) {
            let y1 = Math.max(0,  (im2.rows - LS[j]) / 2);
            let y2 = Math.max(0, -(im2.rows - LS[j]) / 2);
            let x1 = Math.max(0,  (im2.cols - LS[j]) / 2);
            let x2 = Math.max(0, -(im2.cols - LS[j]) / 2);
            let dy_ = Math.min(LS[j], im2.rows);
            let dx_ = Math.min(LS[j], im2.cols);
            // im2_[ y2:y2+dy_, x2:x2+dx_ ] = im2[ n_ ][ y1:y1+dy_, x1:x1+dx_ ]
	    im2_ = new cv.Mat();
	    let rect = new cv.Rect(x1, y1, dx_, dy_);
	    let s = new cv.Scalar(0);
	    cv.copyMakeBorder(mv1.get(i).roi( rect ), im2_, y2, LS[j]-dy_-y2, x2, LS[j]-dx_-x2, cv.BORDER_CONSTANT, s);
            let size = new cv.Size(targetSize[0], targetSize[1]);
            cv.resize(im2_, im2_, size, interpolation=cv.INTER_AREA);
            // mv2.push_back(im2_);
	    if (idx == 0) im30 = im2_;
	    else if (idx == 1) im31 = im2_;
	    else if (idx == 2) im32 = im2_;
	    else if (idx == 3) im33 = im2_;
	    else if (idx == 4) im34 = im2_;
	    else if (idx == 5) im35 = im2_;
	    idx = idx + 1;
            // im2_.delete();
        }
        // if (i == 0) {
        //     cv.merge(mv2, im30);
        // } else {
        //     cv.merge(mv2, im31);
        // }
        mv1.delete();
        // mv2.delete();
    }

    im2.delete();

    return [im30, im31, im32, im33, im34, im35, theta];
};

// メッセージハンドラ本体

onmessage = async (e) => {
    console.log(`worker.js onmessage: ${e.data.action}`);

    if (e.data.action == 'load') {
        var theMap = deserializeMat(e.data.theMap);
        var theMapExtend, origMap;
        var xA, yA, xB, yB;

        [theMap, theMapExtend, origMap, xA, yA, xB, yB] = runLoad(theMap);

        postMessage({
            action: 'load',
            theMap: serializeMat(theMap),
            theMapExtend: serializeMat(theMapExtend),
            origMap: serializeMat(origMap),
            xA: xA,
            yA: yA,
            xB: xB,
            yB: yB
        });

        theMap.delete();
        theMapExtend.delete();
        origMap.delete();
    } else if (e.data.action == 'nextStep') {
        let origMap = deserializeMat(e.data.origMap);
        var xA = e.data.xA;
        var yA = e.data.yA;
        let xB = e.data.xB;
        let yB = e.data.yB;

	console.log(`worker.js onmessage: .......`);
        [im30, im31, im32, im33, im34, im35, theta] = await runNextStepW(origMap, xA, yA, xB, yB);
	console.log(`worker.js onmessage: runNextStepW done.`);

        postMessage({
            action: 'nextStep',
            im30: serializeMat(im30),
            im31: serializeMat(im31),
            im32: serializeMat(im32),
            im33: serializeMat(im33),
            im34: serializeMat(im34),
            im35: serializeMat(im35),
            theta: theta
        });

        im30.delete();
        im31.delete();
        im32.delete();
        im33.delete();
        im34.delete();
        im35.delete();
    }
};
