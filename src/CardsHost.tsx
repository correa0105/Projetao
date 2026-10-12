import { useEffect, useRef, useState } from 'react';

// Coordinates follow the existing scene artwork; the NPC pixels remain in the backdrop.
const silhouette = 'M1236 275 Q1222 265 1240 256 L1258 253 L1271 252 Q1285 248 1306 254 L1314 275 L1323 266 L1327 248 L1334 246 L1330 272 L1341 258 L1345 260 L1337 280 L1350 276 L1348 283 L1334 289 Q1347 298 1336 308 L1326 317 L1333 326 L1334 341 L1344 350 L1358 350 L1378 337 L1380 343 L1409 331 L1410 337 L1392 354 L1434 334 L1439 338 L1410 360 L1450 349 L1452 355 L1422 370 L1459 371 L1463 375 L1438 384 L1471 393 L1476 399 L1449 401 L1481 418 L1489 424 L1460 423 L1494 443 L1492 451 L1474 446 Q1487 476 1500 502 L1510 526 Q1521 555 1516 592 L1525 634 L1519 668 L1531 703 L1535 724 L1551 737 Q1530 745 1506 738 L1480 740 L1452 731 L1420 735 L1376 733 L1358 744 L1329 742 L1293 730 L1264 726 L1262 742 Q1254 756 1239 757 L1220 753 L1212 746 L1215 728 L1207 719 L1191 740 L1164 745 L1141 737 L1134 744 L1099 740 L1087 730 L1066 732 L1047 727 L1080 711 L1099 683 L1103 659 L1090 648 L1094 633 L1119 615 L1133 600 L1143 574 L1157 553 L1163 521 L1164 496 L1178 474 L1186 450 L1200 432 L1207 409 L1205 403 L1214 385 L1227 380 L1234 365 L1243 357 L1245 342 L1235 337 L1231 326 L1224 324 L1227 314 L1241 306 L1232 301 Q1212 299 1226 290 L1245 280 Z';

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
        <path d={silhouette} vectorEffect="non-scaling-stroke" />
      </svg>
    </button>
  );
}
