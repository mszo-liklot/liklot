#!/usr/bin/env node

// Liklot 프로젝트 초기화 스크립트
const fs = require('fs');
const path = require('path');

console.log('🚀 Liklot 초기화 시작...\n');

// 1. 프로젝트 구조 확인
console.log('📁 프로젝트 구조:');
const structure = [
  '├── src/services/ (11개 거래소 + ETL)',
  '├── database/ (PostgreSQL + ClickHouse 스키마)',
  '├── tests/ (매핑 검증 + 거래소 테스트)',
  '├── .env.example (환경 설정 템플릿)',
  '└── SETUP.md (상세 가이드)'
];
structure.forEach(item => console.log(`   ${item}`));

// 2. 환경 파일 확인
console.log('\n🔧 환경 설정 확인...');
if (!fs.existsSync('.env')) {
  if (fs.existsSync('.env.example')) {
    fs.copyFileSync('.env.example', '.env');
    console.log('✅ .env 파일 생성됨 (.env.example에서 복사)');
  } else {
    console.log('❌ .env.example 파일이 없습니다');
  }
} else {
  console.log('✅ .env 파일이 이미 존재합니다');
}

// 3. 필수 디렉토리 확인
console.log('\n📂 필수 디렉토리 확인...');
const requiredDirs = ['src/services', 'database', 'tests'];
requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir} 존재`);
  } else {
    console.log(`❌ ${dir} 없음`);
  }
});

// 4. 거래소 구현 확인
console.log('\n🏢 거래소 구현 확인...');
const exchangeDir = 'src/services/exchanges';
if (fs.existsSync(exchangeDir)) {
  const exchanges = fs.readdirSync(exchangeDir)
    .filter(file => file.endsWith('Exchange.js'))
    .map(file => file.replace('Exchange.js', ''));

  console.log(`✅ ${exchanges.length}개 거래소 구현됨:`);
  exchanges.forEach(ex => console.log(`   - ${ex}`));
} else {
  console.log('❌ 거래소 디렉토리 없음');
}

// 5. 테스트 파일 확인
console.log('\n🧪 테스트 파일 확인...');
const testFiles = [
  'tests/mapping-verification.js',
  'tests/exchange-integration.js',
  'tests/improvement-strategy.js'
];

testFiles.forEach(testFile => {
  if (fs.existsSync(testFile)) {
    console.log(`✅ ${testFile}`);
  } else {
    console.log(`❌ ${testFile} 없음`);
  }
});

// 6. 다음 단계 안내
console.log('\n📋 다음 단계:');
console.log('1. API 키 설정:');
console.log('   nano .env');
console.log('   # COINMARKETCAP_API_KEY=your_key 추가');
console.log('');
console.log('2. 유용한 명령어:');
console.log('   npm run exchanges      # 지원 거래소 확인');
console.log('   npm run test:mapping   # 매핑 시스템 테스트');
console.log('   npm run test:exchanges # 거래소 통합 테스트');
console.log('   npm run test:all       # 전체 테스트');
console.log('   npm run health         # 서버 상태 확인');
console.log('');
console.log('3. 데이터베이스 설정:');
console.log('   npm run db:schema      # 스키마 생성 명령어');
console.log('');
console.log('4. 서버 시작:');
console.log('   npm run dev            # 개발 모드');
console.log('   npm start              # 운영 모드');
console.log('');
console.log('📚 상세 가이드: SETUP.md 참조');
console.log('✅ 초기화 완료!');