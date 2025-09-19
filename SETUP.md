# 🚀 Liklot 초기 설정 가이드

새로운 환경에서 Liklot 프로젝트를 시작하는 완전한 가이드입니다.

## 📋 1. 프로젝트 구조 파악

```bash
# 프로젝트 전체 구조 확인
npm run structure
```

현재 구조:
```
liklot/
├── src/
│   ├── app.js                     # 메인 애플리케이션
│   ├── services/
│   │   ├── ExchangeManager.js     # 11개 거래소 관리
│   │   ├── SymbolMappingService.js # 심볼 매핑 (90%+ 정확도)
│   │   ├── ETLPipeline.js         # 병렬 데이터 처리
│   │   └── exchanges/             # 거래소별 API 구현
│   │       ├── BinanceExchange.js
│   │       ├── UpbitExchange.js
│   │       ├── BybitExchange.js
│   │       ├── KrakenExchange.js
│   │       └── ... (총 11개)
│   └── schedulers/
│       └── MappingUpdateScheduler.js
├── database/
│   ├── postgresql_schema.sql     # 메타데이터 스키마
│   └── clickhouse_schema.sql     # 시계열 데이터 스키마
├── tests/
│   ├── mapping-verification.js   # 매핑 시스템 검증
│   ├── improvement-strategy.js   # 개선 전략 테스트
│   └── exchange-integration.js   # 거래소 통합 테스트
└── .env.example                  # 환경 설정 템플릿
```

## 🔧 2. 초기 설정 (Init)

### Step 1: 의존성 설치
```bash
npm install
```

### Step 2: 환경 설정
```bash
# 환경 파일 생성
cp .env.example .env

# API 키 설정 (필수)
nano .env
```

필수 설정:
```bash
# CoinMarketCap API (무료 키 발급: https://coinmarketcap.com/api/)
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key

# 데이터베이스 연결
DATABASE_URL=postgresql://username:password@localhost:5432/crypto_tracker
REDIS_URL=redis://localhost:6379
CLICKHOUSE_URL=http://localhost:8123
```

### Step 3: 데이터베이스 초기화
```bash
# PostgreSQL 스키마 생성
psql -d crypto_tracker -f database/postgresql_schema.sql

# ClickHouse 스키마 생성
clickhouse-client --query "$(cat database/clickhouse_schema.sql)"
```

### Step 4: 시스템 검증
```bash
# 전체 시스템 테스트
node tests/mapping-verification.js
node tests/exchange-integration.js
```

## 🏢 3. 지원되는 거래소 확인

```bash
# 거래소 목록 확인
node -e "const em = require('./src/services/ExchangeManager'); const e = new em(); console.log('Active exchanges:', e.getActiveExchanges().join(', '))"
```

현재 지원:
- **11개 거래소**: Binance, Upbit, Coinbase, Bithumb, KuCoin, OKX, Bybit, Gate.io, Huobi, Kraken, MEXC
- **192+ 심볼 매핑**: 주요 8개 코인 × 다양한 거래 쌍
- **5개 지역**: 글로벌, 한국, 미국/유럽, 아시아

## 📊 4. 시스템 상태 확인

### 매핑 시스템 테스트
```bash
# 심볼 매핑 정확도 확인
node tests/mapping-verification.js
```

예상 결과:
```
✅ CoinGecko API: PASS
✅ Symbol Mapping: PASS (90%+ 매핑률)
✅ Database Schema: PASS
✅ Rate Limiting: PASS
```

### 거래소 연결 테스트
```bash
# 모든 거래소 API 연결 확인
node tests/exchange-integration.js
```

예상 결과:
```
✅ Exchange Manager: PASS (11개 거래소)
✅ Symbol Mapping Coverage: PASS (192+ 매핑)
✅ Rate Limits: PASS (평균 1115/분)
```

## 🚀 5. 실제 실행

### 개발 모드
```bash
npm run dev
```

### ETL 파이프라인 시작
```bash
# 실시간 데이터 수집 시작
node -e "
const ETL = require('./src/services/ETLPipeline');
const etl = new ETL(/* db connections */);
etl.runETL();
"
```

### 스케줄러 시작
```bash
# 자동 매핑 업데이트 및 VWAP 계산
node -e "
const Scheduler = require('./src/schedulers/MappingUpdateScheduler');
const scheduler = new Scheduler(/* connections */);
scheduler.start();
"
```

## 🔍 6. 문제 해결

### 일반적인 문제들

#### 1. API 키 오류
```bash
# CoinMarketCap API 테스트
curl -H "X-CMC_PRO_API_KEY: your_key" "https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?limit=10"
```

#### 2. 데이터베이스 연결 실패
```bash
# PostgreSQL 연결 테스트
psql $DATABASE_URL -c "SELECT 1;"

# Redis 연결 테스트
redis-cli ping

# ClickHouse 연결 테스트
curl http://localhost:8123/
```

#### 3. 거래소 API 제한
```bash
# 특정 거래소 테스트
node -e "
const Binance = require('./src/services/exchanges/BinanceExchange');
const api = new Binance();
api.healthCheck().then(console.log);
"
```

### 성능 체크
```bash
# ETL 파이프라인 성능 측정
node tests/improvement-strategy.js
```

예상 성능:
- **데이터 수집**: 5초 (병렬 처리)
- **심볼 매핑**: 90%+ 성공률
- **VWAP 계산**: 실시간
- **전체 파이프라인**: ~12초 (75% 개선)

## 📚 7. 추가 리소스

### 문서
- `README.md` - 프로젝트 개요
- `tests/README.md` - 테스트 가이드
- API 문서 (예정)

### 모니터링
```bash
# 시스템 상태 확인
curl http://localhost:3000/health

# 상세 health check
curl http://localhost:3000/health/detailed
```

### 로그 확인
```bash
# 실시간 로그 모니터링
tail -f logs/etl.log
tail -f logs/mapping.log
```

## ⚡ 8. 빠른 시작 (Quick Start)

완전 초기화 스크립트:
```bash
#!/bin/bash
# 전체 초기화
npm install
cp .env.example .env
echo "⚠️ .env 파일에 API 키를 설정하세요"
echo "💡 COINMARKETCAP_API_KEY=your_key"
echo ""
echo "🔧 데이터베이스 설정 후 다음 명령어로 테스트:"
echo "node tests/mapping-verification.js"
```

이제 프로젝트의 전체 구조와 초기화 방법을 완전히 파악할 수 있습니다! 🚀