import { useEffect, useRef, useState } from 'react';

// Coordinates follow the existing scene artwork; the NPC pixels remain in the backdrop.
const silhouette = `
  M1230 278 C1245 265 1271 253 1293 254 C1300 254 1302 267 1305 275
  C1309 264 1310 249 1316 239 C1312 251 1313 259 1310 269
  C1317 253 1325 249 1334 246 C1325 251 1320 260 1317 270
  C1322 264 1326 262 1330 261 C1324 267 1321 274 1319 281
  C1337 280 1337 290 1328 300 C1324 304 1322 306 1321 309
  C1328 315 1323 320 1332 322 C1329 324 1327 325 1325 324
  C1329 331 1329 339 1337 344 C1332 343 1329 341 1327 339
  C1330 346 1340 353 1356 356
  C1364 350 1370 345 1375 344 C1377 348 1369 355 1366 361
  C1380 347 1393 339 1407 333 C1413 330 1409 336 1403 340
  C1395 346 1391 352 1387 359
  C1401 349 1417 342 1433 337 C1442 334 1435 340 1428 344
  C1417 351 1410 357 1405 363
  C1422 359 1438 363 1457 368 C1446 368 1434 370 1426 374
  C1440 376 1451 384 1464 396 C1454 391 1445 390 1438 391
  C1456 403 1463 416 1474 430 C1464 424 1458 420 1453 419
  C1470 438 1477 455 1487 474 C1477 466 1472 460 1467 458
  C1493 484 1501 508 1509 536 C1515 560 1512 590 1516 617
  C1517 651 1514 683 1528 716 C1534 730 1540 731 1555 738
  C1541 742 1529 740 1518 739 C1507 744 1496 737 1489 741
  C1476 744 1466 735 1457 736
  M1457 736 C1447 705 1436 671 1435 642 C1431 601 1437 556 1428 520
  M1379 742 C1360 748 1345 741 1333 743 C1315 744 1307 731 1296 735
  C1282 739 1280 718 1266 721 C1267 735 1266 746 1258 752
  C1248 760 1219 760 1215 748 C1211 738 1215 720 1220 708
  C1223 699 1224 688 1224 681 C1212 691 1207 704 1204 718
  C1198 730 1183 735 1173 739 C1161 745 1149 738 1139 739
  C1145 716 1160 701 1164 683
  M1100 735 C1080 733 1072 727 1060 730 C1053 732 1048 728 1044 728
  C1059 725 1065 717 1073 717 C1090 712 1095 684 1100 664
  C1084 660 1071 655 1066 646 C1060 640 1065 631 1072 631
  C1083 631 1095 640 1102 635 C1117 628 1126 618 1131 608
  C1138 594 1135 578 1127 567 C1147 537 1167 491 1184 463
  M1102 481 C1116 472 1139 473 1157 466 C1167 440 1187 425 1194 408
  C1204 400 1207 395 1209 384 C1215 373 1225 362 1234 353
  C1232 345 1232 339 1237 330 C1228 332 1220 331 1222 325
  C1227 316 1241 311 1248 309 C1242 299 1237 288 1230 278
`;
// The hit area can bridge natural occlusions; the visible line never crosses the chair.
const hitArea = 'M1230 278 Q1280 245 1334 239 L1338 345 L1440 332 Q1480 365 1488 472 Q1535 530 1517 650 L1558 740 L1375 753 L1259 758 L1130 749 L1044 730 L1100 664 L1062 646 L1134 606 L1126 567 L1176 495 L1099 482 L1157 466 L1210 383 L1235 350 L1220 325 L1248 309 Z';

export function CardsHost({ expanded, onTalk }: { expanded: boolean; onTalk: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const [layout, setLayout] = useState({ width: 1672, height: 941, left: 0, top: 0 });
  useEffect(() => {
    const scene = button.current?.parentElement;
    if (!scene) return;
    const update = () => {
      const width = scene.clientWidth, height = scene.clientHeight;
      const mobile = window.matchMedia('(max-width: 650px)').matches;
      const offset = window.matchMedia('(max-width: 900px)').matches ? 0.72 : 0.5;
      const scale = mobile ? 680 / 941 : Math.max(width / 1672, height / 941);
      setLayout({ width: 1672 * scale, height: 941 * scale, left: (width - 1672 * scale) * offset, top: mobile ? 0 : (height - 941 * scale) / 2 });
    };
    const observer = new ResizeObserver(update);
    observer.observe(scene);
    window.addEventListener('resize', update);
    update();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, []);
  return (
    <button ref={button} type="button" className="cards-host-hit" aria-label="Conversar com o Anfitrião" aria-expanded={expanded} onClick={onTalk}>
      <svg aria-hidden="true" className="cards-host-silhouette" viewBox="0 0 1672 941" style={layout}>
        <path className="cards-host-target" d={hitArea} />
        <path className="cards-host-contour" d={silhouette} vectorEffect="non-scaling-stroke" />
      </svg>
    </button>
  );
}
