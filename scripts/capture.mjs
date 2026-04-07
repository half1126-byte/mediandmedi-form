import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const DIR = './screenshots';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 사이즈
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 1. 랜딩 페이지
  await page.goto(BASE);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/00-landing.png`, fullPage: true });
  console.log('✓ 00-landing.png');

  // 2. 신규개원 7스텝
  await page.click('text=신규개원');
  await page.waitForTimeout(1000);

  const stepNames = [
    '01-step1-기본정보',
    '02-step2-진료정보',
    '03-step3-시설장비',
    '04-step4-브랜딩',
    '05-step5-마케팅',
    '06-step6-계약상품',
    '07-step7-최종확인',
  ];

  // Step 1: 기본 정보 (샘플 데이터 입력)
  await page.fill('input[placeholder="예: OO치과의원"]', '해피스마일치과');
  await page.fill('input[placeholder="예: 홍길동"]', '김행복');
  await page.fill('input[type="date"]', '2026-05-01');
  await page.selectOption('select:first-of-type', '서울특별시');
  await page.waitForTimeout(300);
  await page.selectOption('select:nth-of-type(2)', '강남구');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/${stepNames[0]}.png`, fullPage: true });
  console.log(`✓ ${stepNames[0]}.png`);

  // 다음 스텝
  await page.click('text=다음');
  await page.waitForTimeout(500);

  // Step 2: 진료 정보 - 몇 개 칩 클릭
  await page.click('text=충치치료');
  await page.click('text=임플란트 >> nth=0');
  await page.click('text=치아미백');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/${stepNames[1]}.png`, fullPage: true });
  console.log(`✓ ${stepNames[1]}.png`);

  await page.click('text=다음');
  await page.waitForTimeout(500);

  // Step 3: 시설/장비
  await page.click('text=CT(CBCT)');
  await page.click('text=구강스캐너');
  await page.click('text=수술실');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/${stepNames[2]}.png`, fullPage: true });
  console.log(`✓ ${stepNames[2]}.png`);

  await page.click('text=다음');
  await page.waitForTimeout(500);

  // Step 4: 브랜딩
  await page.fill('textarea >> nth=0', '환자 한 명 한 명에게 충분한 시간을 드리는 치과');
  await page.fill('textarea >> nth=1', '과잉진료 없이 꼭 필요한 치료만');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/${stepNames[3]}.png`, fullPage: true });
  console.log(`✓ ${stepNames[3]}.png`);

  await page.click('text=다음');
  await page.waitForTimeout(500);

  // Step 5: 마케팅
  await page.click('text=지인 소개');
  await page.click('text=인터넷 검색');
  await page.click('text=신규 환자 유입');
  await page.click('text=브랜드 인지도');
  await page.click('text=네이버 블로그');
  await page.click('text=인스타그램');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/${stepNames[4]}.png`, fullPage: true });
  console.log(`✓ ${stepNames[4]}.png`);

  await page.click('text=다음');
  await page.waitForTimeout(500);

  // Step 6: 계약 상품
  await page.click('text=카페바이럴');
  await page.click('text=블로그작성(임상)');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/${stepNames[5]}.png`, fullPage: true });
  console.log(`✓ ${stepNames[5]}.png`);

  await page.click('text=다음');
  await page.waitForTimeout(500);

  // Step 7: 최종 확인
  await page.screenshot({ path: `${DIR}/${stepNames[6]}.png`, fullPage: true });
  console.log(`✓ ${stepNames[6]}.png`);

  // 3. 계약변경 페이지
  await page.goto(BASE + '/contract-change');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/08-contract-change.png`, fullPage: true });
  console.log('✓ 08-contract-change.png');

  await browser.close();
  console.log(`\n✅ 전체 ${stepNames.length + 2}장 캡처 완료 → ${DIR}/`);
}

main().catch(console.error);
