# ANIMAL PARTY.io

8개의 io 미니게임을 동물 캐릭터와 장신구를 낀 채로 플레이하는 파티 게임입니다.
최대 5명이 파티 코드로 같이 플레이할 수 있고, 나머지 자리는 봇이 채웁니다.

## 폴더 구조
```
server.js              ← Render에서 실행되는 서버 (정적 파일 + 파티 웹소켓, 외부 패키지 없음)
package.json
render.yaml            ← Render Blueprint 설정
scripts/fetch-three.mjs← 설치할 때 Three.js를 public/lib 에 내려받음
public/index.html      ← 게임 전체 (HTML+JS 한 파일)
public/sounds/         ← (선택) 효과음 mp3 넣는 곳
```

## Render 배포
1. 이 폴더 전체를 GitHub 저장소에 올립니다.
2. Render → New → **Web Service** → 저장소 선택.
3. 설정: Runtime `Node`, Build Command `npm install`, Start Command `npm start`, Health Check Path `/health`.
   (또는 New → Blueprint 로 만들면 render.yaml 설정이 자동 적용됩니다.)
4. 배포가 끝나면 `https://<앱이름>.onrender.com` 에서 바로 게임이 열리고, 파티도 같은 주소로 연결됩니다.

무료 플랜은 15분 동안 접속이 없으면 서버가 잠들어서, 첫 접속 때 30~60초 정도 걸릴 수 있습니다.

## CrazyGames 업로드
1. 로컬에서 `npm install` 을 한 번 실행하면 `public/lib/three.module.js` 가 생깁니다.
2. `public/index.html` 맨 위쪽 `CONFIG.SERVER_URL` 에 Render 주소를 넣습니다.
   예: `SERVER_URL: 'wss://animal-party.onrender.com'`
3. `public` 폴더 안의 파일(index.html, lib/, sounds/)을 zip으로 묶어 CrazyGames 개발자 포털에 올립니다.

CrazyGames SDK v3가 이미 연결되어 있습니다: 로딩 이벤트, gameplayStart/Stop, happytime, 미드게임 광고(광고 중 음소거),
음소거 설정 연동, 파티 초대 버튼(invite link의 roomId로 자동 참가), CrazyGames 닉네임 자동 적용.

## 개발용 설정 (index.html 의 CONFIG)
- `UNLIMITED_MONEY: true` 코인 무한
- `UNLOCK_ALL: true` 모든 동물·장신구 해금
- `SOUND_FILES: false` → `true` 로 바꾸면 `public/sounds/<이름>.mp3` 를 우선 사용 (없으면 내장 신스음)

## 효과음 파일 이름
click, jump, land, dash, hit, pop, coin, eat, boom, shoot, splat, tick, go, win, lose, item, boost, error, whoosh, join
(Mixkit, Kenney 등에서 받은 mp3를 이 이름으로 넣으면 됩니다.)

## 조작
- PC: WASD 이동 · SPACE 점프/주요 액션 · SHIFT 대시/보조 액션 · 마우스 조준/발사 · ESC 일시정지
- 모바일: 가로 화면 전용 · 왼쪽 조이스틱 · 오른쪽 A/B 버튼

## 파티
- CREATE PARTY → 5자리 코드가 생깁니다. 친구는 코드를 입력하고 JOIN.
- 파티장이 PLAY를 누르면 모두 같은 라운드에 들어갑니다. 파티장이 게임을 호스팅하고 나머지는 입력만 보냅니다.
- 파티장이 나가면 다음 사람이 자동으로 파티장이 됩니다.
