// Account guidance from the supplied hospital onboarding document.
const guides = {
common: { label: '공통 계정 준비·포털 인증', content: <><section className="space-y-2">
<h4 className="font-semibold">계정 명의</h4>
<p>대표자 명의로 생성하며, 개인적으로 사용하는 계정과 분리된 병원용 계정으로 만들어주세요. 개원 후 직원과 마케팅 담당자가 함께 사용해야 하므로 병원에서 지속적으로 관리할 수 있는 계정이어야 합니다.</p>
</section><section className="space-y-2"><h4 className="font-semibold">포털 인증</h4><p>네이버·카카오·구글의 초기 세팅은 의료기관개설허가증 또는 의료기관개설신고증 발급 후 진행합니다. 인증 당일에는 SMS 또는 2단계 인증번호를 실시간으로 요청드릴 예정이며, 오류 없이 진행되는 경우 약 1시간 정도 소요됩니다.</p></section></> },
naver: { label: '네이버', content: <>
<section className="space-y-2">
<h4 className="font-semibold text-blue-600">Q. 네이버 계정을 새로 만들 때 주의할 점은 무엇인가요?</h4>
<p>네이버 단체 아이디는 덴트웹과 연동되지 않으므로 사용하지 않습니다. 대표자 명의의 개인 아이디로 병원 전용 계정을 만들어주세요. 개인 아이디는 1인당 최대 3개까지 생성할 수 있으므로 이미 3개를 사용 중이라면 기존 아이디 하나를 정리한 뒤 새로 생성해야 합니다. 대표자 명의로 만들어야 스마트플레이스·예약·덴트웹 연동을 원활하게 진행할 수 있습니다.</p>
</section>


</> },
google: { label: '구글', content: <>
<section className="space-y-2">
<h4 className="font-semibold text-blue-600">Q. 구글 비즈니스 계정은 어떻게 생성하나요?</h4>
<p>대표자 명의의 병원용 Google 계정을 만든 뒤 Google 비즈니스 프로필을 생성합니다. 프로필 인증 방법은 전화·이메일·영상 등 병원별로 다르게 제시될 수 있습니다. 전화 인증이 필요한 경우 병원 대표번호에 ARS 안내가 설정되어 있으면 인증 전화를 정상적으로 받기 어려울 수 있으므로, 인증 시간 동안 전화를 직접 받을 수 있도록 준비하거나 화면에 제시된 다른 인증 방법을 선택해주세요. <a href="https://business.google.com/" target="_blank" rel="noopener noreferrer">Google 비즈니스 프로필 바로가기</a>
</p>
</section>

</> },
kakao: { label: '카카오', content: <>
<section className="space-y-2">
<h4 className="font-semibold text-blue-600">Q. 카카오 계정은 어떻게 만들어야 하나요?</h4>
<p>휴대전화에서 개인적으로 사용하는 카카오톡 계정을 그대로 공유하지 않고, 병원 운영용 계정을 별도로 준비해 카카오비즈니스에서 새로 세팅합니다. <a href="https://business.kakao.com/" target="_blank" rel="noopener noreferrer">카카오비즈니스 바로가기</a>에 접속해 계정을 생성하고 매장 및 비즈니스 채널을 연결해주세요.</p>
</section>

</> },
danggeun: { label: '당근', content: <>
<section className="space-y-2">
<h4 className="font-semibold text-blue-600">Q. 당근 비즈프로필 운영자 권한은 어떻게 주나요?</h4>
<ol>
<li>병원 소유 계정으로 당근 비즈프로필을 생성합니다.</li>
<li>비즈프로필 관리 화면에서 <b>운영자 초대</b>를 선택합니다.</li>
<li>생성된 초대 링크와 6자리 초대 코드를 마케팅 담당자에게 전달합니다.</li>
<li>담당자가 링크에 접속해 코드를 입력하고 <b>운영자 수락</b>을 누르면 공동 관리가 시작됩니다.</li>
<li>병원 계정은 소유자 권한을 계속 유지합니다.</li>
</ol>
<p>
<a href="https://business.daangn.com/edu/vod/377257b1-a0e3-427a-9c5b-0b94c7daf84a/%EB%B9%84%EC%A6%88%ED%94%84%EB%A1%9C%ED%95%84-%EC%9A%B4%EC%98%81%EC%9E%90-%EC%B4%88%EB%8C%80%ED%95%98%EB%8A%94-%EB%B2%95" target="_blank" rel="noopener noreferrer">당근 공식 운영자 초대 안내 보기</a>
<span className="block mt-2 font-semibold">초대 코드는 비즈프로필 운영 권한을 주는 코드이며, 계정 비밀번호가 아닙니다.</span>
</p>
</section>
</> },
} as const;

export default function AccountGuide({ channel }: { channel: string }) {
 if (!(channel in guides)) return null;
 const guide = guides[channel as keyof typeof guides];
 return <details className="account-guide">
 <summary className="cursor-pointer text-sm font-semibold text-blue-900">{guide.label} 가이드 보기</summary>
 <div className="mt-[14px] space-y-[14px] text-sm text-gray-900 break-words [&_a]:underline [&_a]:text-blue-600 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">{guide.content}</div>
 </details>;
}
