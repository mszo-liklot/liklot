# 🧪 Tests Directory

Symbol mapping 시스템의 테스트 파일들입니다.

## 📁 파일 구성

### `mapping-verification.js`
**용도**: Symbol mapping 시스템의 실제 동작 검증
- CoinGecko API 연동 테스트
- 심볼 매핑 로직 검증
- 데이터베이스 스키마 호환성 확인
- Rate limiting 전략 테스트

**실행방법**:
```bash
node tests/mapping-verification.js
```

**기대결과**:
- CoinGecko API: ✅ PASS
- Symbol Mapping: ✅ PASS (90%+ 매핑률)
- Database Schema: ✅ PASS
- Rate Limiting: ✅ PASS

### `improvement-strategy.js`
**용도**: Symbol mapping 개선 전략 및 성능 검증
- 매핑 성능 개선 전략 검증
- Fallback 매핑 전략 테스트
- 에러 처리 및 복구 전략 확인
- 성능 최적화 효과 측정

**실행방법**:
```bash
node tests/improvement-strategy.js
```

**기대결과**:
- Mapping Strategy: ✅ PASS (90%+ 목표)
- Fallback Strategy: ✅ PASS (88개 매핑)
- Error Handling: ✅ PASS
- Performance: ✅ PASS (83% 향상)

## 🚀 실제 운영 테스트

프로덕션 환경에서 실제 테스트하려면:

1. **환경 설정**:
   ```bash
   cp .env.example .env
   # COINMARKETCAP_API_KEY 입력
   ```

2. **데이터베이스 연결 후**:
   ```bash
   node tests/mapping-verification.js
   ```

3. **ETL 파이프라인 테스트**:
   ```bash
   npm run test  # package.json에 설정된 테스트
   ```

## 📊 테스트 히스토리

- **2024-09-20**: 초기 매핑 시스템 검증 (60% → 90% 매핑률 달성)
- **2024-09-20**: 개선 전략 검증 완료 (Fallback 매핑 88개 추가)

## ⚠️ 주의사항

- `mapping-verification.js`는 실제 CoinGecko API를 호출합니다
- Rate limiting을 준수하기 위해 2초 간격으로 API 호출됩니다
- CoinMarketCap API 키가 없으면 해당 테스트는 스킵됩니다