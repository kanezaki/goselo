// 行列の要素が pred の条件に合うなら func1 の返り値で、合わないなら func2 の返り値で上書きする。
// 8U -> 8U を想定。
let cvFilterMat = (src, dst, pred, func1, func2) => {
  for (var i=0;i<src.rows;i++) {
      for (var j=0;j<src.cols;j++) {
          for (var k=0;k<src.channels();k++) {
              let value = src.ucharPtr(i, j)[k];
              if (pred(value)) {
                  dst.ucharPtr(i, j)[k] = func1(value);
              } else {
                  dst.ucharPtr(i, j)[k] = func2(value);
              }
          }
      }
  }
};
// // 行列の要素が pred の条件に合うなら func1 の返り値で、合わないなら func2 の返り値で上書きする。
// let cvFilterMatF = (src, dst, pred, func1, func2) => {
//   for (var i=0;i<src.rows;i++) {
//       for (var j=0;j<src.cols;j++) {
//           for (var k=0;k<src.channels();k++) {
//               let value = src.floatPtr(i, j)[k];
//               if (pred(value)) {
//                   dst.floatPtr(i, j)[k] = func1(value);
//               } else {
//                   dst.floatPtr(i, j)[k] = func2(value);
//               }
//           }
//       }
//   }
// };
// // 行列 src の一部を行列 dst の一部にコピーする。
// let cvCopyMat = (src, dst, x1, y1, x2, y2, n, m) => {
//   for (var i=0;i<m;i++) {
//       for (var j=0;j<n;j++) {
//           for (var k=0;k<src.channels();k++) {
//               dst.ucharPtr(y2 + i, x2 + j)[k] = src.ucharPtr(y1 + i, x1 + j)[k] / 2;
//           }
//       }
//   }
// };
// Mat をプレーンオブジェクトにシリアライズする。
let serializeMat = (mat) => {
  return {
      data: mat.data,
      rows: mat.rows,
      cols: mat.cols,
      type: mat.type()
  };
};
// プレーンオブジェクトを Mat にデシリアライズする。
let deserializeMat = (o) => {
  return cv.matFromArray(o.rows, o.cols, o.type, o.data);
};
// // im30 と im31 を Float32Array にコピーする専用メソッド。
// // python 版と同様に 255 分の 1 にスケールする。
// let cvCopyIm30Im31ToInputArray = (im30, im31, inputArray) => {
//     for (var k=0;k<3;k++) {
//         for (var j=0;j<im30.rows;j++) {
//             for (var i=0;i<im30.cols;i++) {
//                 inputArray[(k + 0) * im30.rows * im30.cols + j * im30.cols + i] = im30.ucharPtr(j, i)[k]
//                 inputArray[(k + 3) * im30.rows * im30.cols + j * im30.cols + i] = im31.ucharPtr(j, i)[k]
//             }
//         }
//     }
// };
