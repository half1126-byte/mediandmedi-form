// Local-only browser regression. The submission endpoint is always intercepted.
// Run with: node test/e2e/new-clinic.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

async function run() {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  try {
    for (const preset of ['web', 'marketing', 'package']) {
      const context = await browser.newContext({ viewport: { width: Number(process.env.FORM_TEST_WIDTH || 390), height: 844 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let submitted;
      await page.route('**/api/**', async (route) => {
        if (route.request().url().endsWith('/api/submit')) {
          submitted = route.request().postDataJSON();
          await route.fulfill({ json: { success: true, pageId: 'local-intercepted-test', pin: submitted.pin } });
        } else {
          await route.abort();
        }
      });
      await page.goto(`http://localhost:3000/new-clinic?preset=${preset}`);
      const requiredNotice = page.getByRole('status').filter({ hasText: '필수 항목 중' });
      assert.match(await requiredNotice.innerText(), /치과명/);
      await page.getByPlaceholder('예: OO치과의원').fill('로컬 테스트 치과');
      assert.doesNotMatch(await requiredNotice.innerText(), /치과명/);
      assert.match(await requiredNotice.innerText(), /대표전화/);
      assert.match(await requiredNotice.getAttribute('class'), /text-red-600/);
      assert.ok((await requiredNotice.boundingBox()).y < (await page.getByRole('button', {name: /^다음/}).boundingBox()).y);
      await page.locator('select').filter({ has: page.locator('option[value="서울특별시"]') }).selectOption('서울특별시');
      await page.locator('select').filter({ has: page.locator('option[value="강남구"]') }).selectOption('강남구');
      assert.equal(await page.getByPlaceholder('예: 홍길동').count(), 0);
      assert.equal(await page.getByRole('button', { name: /^다음/ }).isDisabled(), true);
      await page.getByPlaceholder('예: 02-1234-5678').fill('02-1234-5678');
      assert.equal(await page.getByRole('button', { name: /^다음/ }).isDisabled(), true);
      await page.getByPlaceholder('예: OO빌딩 3층').fill('테헤란로 123 3층');
      assert.equal(await page.locator('[role=region]:visible').count(), 1);
      await page.getByRole('button', { name: '개원일정 입력', exact: true }).click();
      assert.equal(await page.getByPlaceholder('예: OO치과의원').isVisible(), false);
      assert.equal(await page.locator('input[type=date]:visible').count(), 4);
      await page.getByLabel('개원 일정 미정').check();
      await page.getByRole('button', { name: '의료진 입력', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: /^다음/ }).isDisabled(), true);
      await page.getByLabel('대표원장 성함', { exact: true }).fill('김테스트');
      await page.getByPlaceholder('예: OO대학교 치과대학 졸업, OO대학교 대학원 치의학 석사').fill('테스트대학교 졸업');
      assert.equal(await page.getByRole('button', { name: /^다음/ }).isDisabled(), true);
      await page.getByPlaceholder('예: OO치과병원 수련, OO과 전문의, 전) OO치과 부원장').fill('테스트병원 근무');
      await page.getByRole('button', { name: '의료진 수 증가' }).click();
      assert.equal(await page.getByRole('button', { name: /^다음/ }).isDisabled(), true);
      assert.equal(await page.getByLabel('대표원장 성함', { exact: true }).isVisible(), false);
      await page.getByLabel('의료진 2 성함', { exact: true }).fill('이테스트');
      await page.getByPlaceholder('예: OO대학교 치과대학 졸업, OO대학교 대학원 치의학 석사').nth(1).fill('다른대학교 졸업');
      assert.equal(await page.getByRole('button', { name: /^다음/ }).isDisabled(), true);
      await page.getByPlaceholder('예: OO치과병원 수련, OO과 전문의, 전) OO치과 부원장').nth(1).fill('다른병원 근무');
      await page.locator('#doctor-0-heading').click();
      assert.equal(await page.getByLabel('의료진 2 성함', { exact: true }).isVisible(), false);
      assert.equal(await page.getByPlaceholder('예: OO대학교 치과대학 졸업, OO대학교 대학원 치의학 석사').nth(0).inputValue(), '테스트대학교 졸업');
      assert.match(await page.locator('#doctor-1-heading').innerText(), /이테스트/);
      await page.locator('#doctor-1-heading').click();
      assert.equal(await page.getByPlaceholder('예: OO치과병원 수련, OO과 전문의, 전) OO치과 부원장').nth(1).inputValue(), '다른병원 근무');
      await page.getByRole('button', { name: '의료진 수 증가' }).click();
      assert.equal(await page.getByLabel('의료진 3 성함', { exact: true }).isVisible(), true);
      await page.getByRole('button', { name: '의료진 수 감소' }).click();
      assert.equal(await page.getByLabel('의료진 2 성함', { exact: true }).isVisible(), true);

      await page.locator('#basic-hospital-heading').click();
      assert.equal(await page.getByPlaceholder('예: OO치과의원').inputValue(), '로컬 테스트 치과');
      assert.equal(await page.locator('[role=region]:visible').count(), 1);
      await page.locator('#basic-doctors-heading').click();
      const next = async () => { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'step must not overflow'); await page.getByRole('button', { name: /^다음/ }).click(); };
      await next();
      await page.locator('section[aria-label="일반진료 세부 항목"]').getByRole('button', { name: '일반진료', exact: true }).click();
      await page.getByRole('button', { name: '구강검진', exact: true }).click();
      await page.locator('section[aria-label="임플란트 세부 항목"]').getByRole('button', { name: '임플란트', exact: true }).click();
      const implant = page.locator('section[aria-label="임플란트 세부 항목"]');
      await implant.getByRole('button', { name: '전체 임플란트', exact: true }).click();
      await implant.getByRole('button', { name: '오스템', exact: true }).click();
      await implant.getByRole('button', { name: 'SOI', exact: true }).click();
      await page.locator('section[aria-label="교정 세부 항목"]').getByRole('button', { name: '교정', exact: true }).click();
      const ortho = page.locator('section[aria-label="교정 세부 항목"]');
      assert.equal(await page.locator('[id^="treatment-"]:visible').count(), 1);
      assert.equal(await implant.getByRole('button', { name: 'SOI', exact: true }).isVisible(), false);
      assert.match(await implant.getByRole('button', { name: '임플란트', exact: true }).innerText(), /전체 임플란트/);
      await implant.getByRole('button', { name: '임플란트', exact: true }).click();
      assert.equal(await implant.getByRole('button', { name: 'SOI', exact: true }).isVisible(), true);
      await page.locator('section[aria-label="교정 세부 항목"]').getByRole('button', { name: '교정', exact: true }).click();

      await ortho.getByRole('button', { name: '투명교정', exact: true }).click();
      await ortho.getByRole('button', { name: '인비절라인', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: '원데이 임플란트', exact: true }).count(), 0);
      const priority = page.getByRole('group', { name: '주력 진료', exact: true });
      await priority.getByRole('button', { name: '임플란트', exact: true }).click();
      await priority.getByRole('button', { name: '기타', exact: true }).click();
      await priority.getByPlaceholder('그 외 알리고 싶은 진료를 입력해 주세요').fill('맞춤 진료');
      await page.getByPlaceholder('예: 넓고 쾌적한 공간, 최신 장비, 프라이빗 진료실, 원내 기공소, 야간진료', { exact: true }).fill('충분한 설명');
      await page.locator('#clinic-features-heading').click();
      assert.equal(await page.locator('#clinic-features-panel').isVisible(), false);
      assert.match(await page.locator('#clinic-features-heading').innerText(), /충분한 설명/);
      await page.locator('#clinic-features-heading').click();
      assert.equal(await page.getByPlaceholder('예: 넓고 쾌적한 공간, 최신 장비, 프라이빗 진료실, 원내 기공소, 야간진료', { exact: true }).inputValue(), '충분한 설명');
      await next();
      assert.equal(await page.locator('#basic-operation-hours-heading').getAttribute('aria-expanded'), 'true');
      await page.getByRole('button', { name: '월요일 야간진료', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: '월요일 야간진료', exact: true }).getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: '공휴일', exact: true }).click();
      await page.getByLabel('공휴일 진료 종료 시간').selectOption('15:00');
      assert.equal(await page.getByRole('button', { name: '요일별 설정', exact: true }).count(), 0);
      await page.getByLabel('공통 점심시간 시작').selectOption('12:00');
      await page.getByLabel('공통 점심시간 종료').selectOption('13:00');
      await page.getByRole('button', { name: '시설·장비 입력', exact: true }).click();
      assert.match(await page.locator('#basic-operation-hours-heading').innerText(), /공휴일.*15:00/);
      assert.match(await page.locator('#basic-operation-hours-heading').innerText(), /야간/);
      assert.equal(await page.locator('#basic-operation-hours-panel').isVisible(), false);
      for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '체어 수 증가', exact: true }).click();
      await page.getByRole('button', { name: '구강스캐너', exact: true }).first().click();
      await page.getByLabel('구강스캐너 제품명·모델명', { exact: true }).fill('프라임스캔 AC, 테스트 모델');
      await page.getByRole('button', { name: '기타 장비', exact: true }).click();
      await page.getByRole('textbox', { name: '기타 장비명·제품명', exact: true }).fill('기타 테스트 장비');
      assert.equal(await page.getByLabel('구강스캐너 제품명·모델명', { exact: true }).isVisible(), false);
      assert.match(await page.locator('#equipment-heading-0').innerText(), /프라임스캔 AC/);
      await page.locator('#equipment-heading-0').click();
      assert.equal(await page.getByRole('textbox', { name: '기타 장비명·제품명', exact: true }).isVisible(), false);
      await page.getByRole('button', { name: '구강스캐너', exact: true }).first().click();
      assert.equal(await page.getByLabel('구강스캐너 제품명·모델명', { exact: true }).count(), 0);
      await page.getByRole('button', { name: '구강스캐너', exact: true }).first().click();
      assert.equal(await page.getByLabel('구강스캐너 제품명·모델명', { exact: true }).inputValue(), '프라임스캔 AC, 테스트 모델');
      await page.locator('#equipment-list-heading').click();
      assert.equal(await page.locator('#equipment-list-panel').isVisible(), false);
      assert.match(await page.locator('#equipment-list-heading').innerText(), /구강스캐너: 프라임스캔 AC/);
      await page.locator('#equipment-list-heading').click();
      assert.equal(await page.getByLabel('구강스캐너 제품명·모델명', { exact: true }).inputValue(), '프라임스캔 AC, 테스트 모델');
      await page.locator('#basic-operation-hours-heading').click();
      assert.equal(await page.locator('#basic-operation-facilities-panel').isVisible(), false);
      assert.match(await page.locator('#basic-operation-facilities-heading').innerText(), /체어 8대/);
      await page.locator('#basic-operation-facilities-heading').click();
      assert.equal(await page.getByText('8대', { exact: true }).isVisible(), true);
      assert.equal(await page.getByRole('button', { name: /^다음/ }).isDisabled(), true);
      await page.getByRole('button', { name: '수술실', exact: true }).click();
      await page.getByRole('button', { name: '가능', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: /^다음/ }).isDisabled(), true);
      await page.getByRole('button', { name: '보유', exact: true }).click();
      await page.getByRole('button', { name: '밀링머신', exact: true }).click();
      await page.getByRole('button', { name: '신터링기', exact: true }).click();
      await page.getByRole('button', { name: '기타 직접 추가', exact: true }).click();
      await page.getByLabel('기타 기공소 장비명').fill('3D 프린터, 집진기');
      await page.getByRole('button', { name: '추가', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: /^다음/ }).isEnabled(), true);
      await next();
      assert.equal(await page.getByPlaceholder('예: OO대학교 치과대학 졸업, OO대학교 대학원 치의학 석사').count(), 0);
      await page.getByRole('button', { name: '신뢰감', exact: true }).click();
      await page.getByRole('button', { name: '블루', exact: true }).click();
      await page.getByPlaceholder('예: 빨강, 지나치게 어두운 색상 (선택)').fill('없음');
      assert.equal(await page.getByText('병원 인테리어 톤', { exact: true }).count(), 0);
      await page.locator('#materials-heading').click();
      assert.match(await page.locator('#basic-brand-image-heading').innerText(), /블루/);
      await page.getByRole('button', { name: '원장 프로필', exact: true }).click();
      await page.getByRole('button', { name: '공유 링크', exact: true }).click();
      await page.getByPlaceholder('구글 드라이브·클라우드 공유 링크').fill('https://example.com/local-test-materials');
      await page.locator('#materials-heading').click();
      assert.equal(await page.locator('#materials-panel').isVisible(), false);
      assert.match(await page.locator('#materials-heading').innerText(), /원장 프로필.*공유 링크/);
      await page.locator('#materials-heading').click();
      assert.equal(await page.getByPlaceholder('구글 드라이브·클라우드 공유 링크').inputValue(), 'https://example.com/local-test-materials');
      await next();
      if (preset !== 'web') {
        assert.equal(await page.getByRole('button', { name: /^다음/ }).isDisabled(), true);
        await page.getByRole('button', { name: '신규 환자 유입', exact: true }).click();
        await page.getByRole('button', { name: '네이버 블로그', exact: true }).click();
        await page.locator('#basic-marketing-events-heading').click();
        await page.locator('summary').filter({ hasText: '대기실 모니터 (DID)' }).click();
        await page.getByPlaceholder('예: 데스크 왼쪽 1대 가로(교정 영상), 진료실 입구 오른쪽 1대 세로 / 미설치').fill('미설치');
        await page.locator('#basic-marketing-accounts-heading').click();
        for (const label of ['네이버', '구글', '카카오', '대한치과협회 의료광고심의']) {
          const accountGroup = page.getByRole('group', { name: `${label} *`, exact: true, includeHidden: true });
          assert.equal(await accountGroup.isVisible(), false);
          await accountGroup.locator('..').locator(':scope > summary').click();
          await page.getByRole('group', { name: `${label} *`, exact: true }).getByRole('button', { name: '아직 준비하지 못했어요', exact: true }).click();
          await accountGroup.locator('..').locator(':scope > summary').click();
          assert.equal(await accountGroup.isVisible(), false);
          await accountGroup.locator('..').locator(':scope > summary').click();
          assert.equal(await accountGroup.getByRole('button', { name: '아직 준비하지 못했어요', exact: true }).getAttribute('aria-pressed'), 'true');
        }

        await next();
      } else {
        assert.equal(await page.getByText('마케팅 목표 (최대 3개)', { exact: true }).count(), 0);
      }
      if (preset !== 'marketing') {
        const headings = page.locator('[id^="basic-web-"][id$="-heading"]');
        const names = await headings.allTextContents();
        ['일정·유지보수', '관리 방식', '오시는 길', '온라인 채널', '웹 계정정보', '홈페이지 레퍼런스'].forEach((name, index) => {
          assert(names[index].includes(name));
          assert.equal(names[index].includes('*'), index < 2);
        });
        await page.getByPlaceholder('예: 2026년 8월 말 오픈 희망').fill('12월 중');
        await page.getByRole('button', { name: '미정', exact: true }).click();
        await page.locator('#basic-web-features-heading').click();

        await page.getByRole('button', { name: '미정', exact: true }).click();
        await page.getByRole('button', { name: '신규 제작', exact: true }).click();
        await page.getByRole('button', { name: '카카오톡', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: /^다음/ }).isDisabled(), true);
        await page.getByPlaceholder('예: clinic.co.kr').fill('clinic.co.kr');
        assert.equal(await page.getByRole('button', { name: /^다음/ }).isDisabled(), true);
        await page.getByRole('button', { name: '미설치', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: /^다음/ }).isEnabled(), true);
        assert.equal(await page.locator('#basic-web-pages-heading').count(), 0);
        assert.equal(await page.getByText('필요한 기능 (선택)', { exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: /^다음/ }).isEnabled(), true);
        await page.locator('#basic-web-accounts-heading').click();
        assert.equal(await page.getByText('도메인', { exact: true }).count(), 0);
        await page.locator('#basic-web-references-heading').click();
        await page.getByPlaceholder('예: https://example.com — 메인 화면 구성과 색감이 마음에 들어요.').fill('https://example.com — 색감');
        assert.equal(await page.getByText('제공 가능한 사진 종류', { exact: true }).count(), 0);
        await next();
      }
      if (preset === 'package') {
        assert.equal(await page.getByText('로고 타입', { exact: true }).count(), 1);
        await page.locator('#basic-design-video-heading').click();
        assert.equal(await page.getByText('영상 핵심 메시지', { exact: true }).isVisible(), true);
        assert.equal(await page.getByText('로고 타입', { exact: true }).isVisible(), false);
        await next();
      }
      await page.getByRole('heading', { name: '최종 확인', exact: true }).waitFor();
      assert.equal(await page.getByText('병원의 강점', { exact: true }).count(), 1);
      await page.getByPlaceholder('추가로 전달할 내용이 있으면 적어 주세요.').fill('로컬 테스트 요청');
      await page.getByLabel('위 내용을 모두 확인했습니다.').check();
      await page.getByRole('button', { name: /제출/ }).click();
      await page.waitForURL('**/summary?**');
      assert.deepEqual(submitted.step2.implantMaterials['오스템'], ['SOI']);
      assert.deepEqual(submitted.step2.alignerOptions, ['인비절라인']);
      assert.deepEqual(submitted.step3.labEquipment, ['밀링머신', '신터링기', '3D 프린터', '집진기']);
      assert.equal(submitted.step3.labLocation, undefined); // optional details may be skipped
      assert.equal(submitted.step1.doctorName, '김테스트');
      assert.equal(submitted.step4.education, '테스트대학교 졸업');
      assert.equal(submitted.step1.doctors[1].education, '다른대학교 졸업');
      assert.equal(submitted.step1.doctors[1].career, '다른병원 근무');
      assert.equal(submitted.step1.openDate, '');
      assert.equal(submitted.step1.openDatePending, true);
      assert.equal(submitted.step4.clinicPromo, '충분한 설명');
      assert.equal(submitted.step4.materialDelivery, '공유 링크');
      assert.equal(submitted.step4.hasProfilePhoto, true);
      assert(submitted.stepWeb.photoTypes.includes('원장 프로필'));
      assert.equal(submitted.step5.additionalRequest, '로컬 테스트 요청');
      assert.deepEqual(errors, []);
      console.log(`PASS ${preset}: mobile form → intercepted submission → summary`);
      if (preset === 'package') {
        for (const kind of ['logo', 'video']) {
          const restored = structuredClone(submitted);
          restored.scope = { marketing: false, viral: false, web: false, logo: kind === 'logo', video: kind === 'video' };
          const restoreContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
          const restorePage = await restoreContext.newPage();
          await restorePage.route('**/api/**', (route) => route.abort());
          await restorePage.addInitScript((data) => {
            localStorage.clear();
            localStorage.setItem('mediandmedi-form-restore-test', JSON.stringify({ sessionId: 'restore-test', currentStep: 4, currentStepId: 'design', totalSteps: 6, directorMode: true, savedAt: new Date().toISOString(), data }));
          }, restored);
          await restorePage.goto('http://localhost:3000/new-clinic');
          await restorePage.getByRole('button', { name: '이어서 작성' }).click();
          await restorePage.getByText(kind === 'logo' ? '로고 타입' : '영상 핵심 메시지', { exact: true }).waitFor();
          assert.equal(await restorePage.getByText(kind === 'logo' ? '영상 핵심 메시지' : '로고 타입', { exact: true }).count(), 0);
          await restorePage.getByRole('button', { name: /^이전/ }).click();
          await restorePage.locator('#materials-heading').click();
          await restorePage.getByPlaceholder('구글 드라이브·클라우드 공유 링크').waitFor();
          assert.equal(await restorePage.getByPlaceholder('구글 드라이브·클라우드 공유 링크').inputValue(), 'https://example.com/local-test-materials');
          assert.equal(await restorePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'mobile layout must not overflow');
          console.log(`PASS restored ${kind}-only: scope gating and saved materials`);
          await restoreContext.close();
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
