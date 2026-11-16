// 단계 모듈을 한 번씩 불러 F 표에 넣는다 (각 폴더 index.ts가 register를 부른다)
import "./intake";
import "./budget"; // 첫 질문(welcome)을 intake보다 뒤에 넣어 덮는다
import "./materials";
import "./doc";
import "./ai";
import "./tools";
