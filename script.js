
class SubwayTracker {
    constructor() {
        this.positionApiKey = '537870787068796534376353654b4f';
        this.arrivalApiKey = '4c47464a6f6879653832536c464d77';
        
        this.positionLineSelect = document.getElementById('positionLineSelect');
        this.positionRefreshBtn = document.getElementById('positionRefreshBtn');
        this.arrivalRefreshBtn = document.getElementById('arrivalRefreshBtn');
        this.positionLastUpdateEl = document.getElementById('positionLastUpdate');
        this.arrivalLastUpdateEl = document.getElementById('arrivalLastUpdate');
        this.statusEl = document.getElementById('status');
        this.positionListEl = document.getElementById('positionList');
        this.arrivalListEl = document.getElementById('arrivalList');
        this.positionLoadingEl = document.getElementById('positionLoading');
        this.arrivalLoadingEl = document.getElementById('arrivalLoading');
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.tabPanels = document.querySelectorAll('.tab-panel');
        
        this.currentTab = 'position';
        this.lineNames = {
            '1001': '1호선', '1002': '2호선', '1003': '3호선', '1004': '4호선',
            '1005': '5호선', '1006': '6호선', '1007': '7호선', '1008': '8호선',
            '1009': '9호선', '1063': '경의중앙선', '1065': '공항철도', 
            '1067': '경춘선', '1075': '수인분당선', '1077': '신분당선', '1092': '우이신설선'
        };
        
        this.allArrivalData = [];
        this.selectedStation = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadPositionData();
        this.loadArrivalData();
        
        // 30초마다 자동 새로고침
        setInterval(() => {
            if (this.currentTab === 'position') {
                this.loadPositionData();
            } else {
                this.loadArrivalData();
            }
        }, 30000);
    }
    
    setupEventListeners() {
        this.positionRefreshBtn.addEventListener('click', () => this.loadPositionData());
        this.arrivalRefreshBtn.addEventListener('click', () => this.loadArrivalData());
        this.positionLineSelect.addEventListener('change', () => this.loadPositionData());
        
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // 검색 관련 이벤트 리스너
        const stationSearch = document.getElementById('stationSearch');
        const clearSearch = document.getElementById('clearSearch');
        const showAllStations = document.getElementById('showAllStations');
        
        if (stationSearch) {
            stationSearch.addEventListener('input', (e) => {
                this.handleStationSearch(e.target.value);
            });
        }
        
        if (clearSearch) {
            clearSearch.addEventListener('click', () => {
                this.clearStationSearch();
            });
        }
        
        if (showAllStations) {
            showAllStations.addEventListener('click', () => {
                this.showAllStations();
            });
        }
    }
    
    switchTab(tabName) {
        this.currentTab = tabName;
        
        this.tabBtns.forEach(btn => btn.classList.remove('active'));
        this.tabPanels.forEach(panel => panel.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }
    
    async loadPositionData() {
        try {
            this.positionLoadingEl.style.display = 'flex';
            this.positionListEl.innerHTML = '';
            this.positionRefreshBtn.disabled = true;
            this.positionRefreshBtn.textContent = '🔄 불러오는 중...';
            
            const selectedLine = this.positionLineSelect.value;
            const lineName = this.lineNames[selectedLine];
            
            // 첫 번째 API 시도
            try {
                const lineCode = this.getLineCode(selectedLine);
                const url = `http://swopenapi.seoul.go.kr/api/subway/${this.positionApiKey}/xml/realtimePosition/0/50/${encodeURIComponent(lineCode)}`;
                const proxyUrl = 'https://api.allorigins.win/raw?url=';
                
                const response = await fetch(proxyUrl + encodeURIComponent(url));
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                
                // 첫 번째 API에서 데이터가 있으면 파싱
                const rows = xmlDoc.getElementsByTagName('row');
                if (rows.length > 0) {
                    this.parseAndDisplayPositionData(xmlDoc, lineName);
                    this.updatePositionLastUpdateTime();
                    return;
                }
                throw new Error('No data from first API');
                
            } catch (firstApiError) {
                console.log('First API failed, trying second API:', firstApiError);
                
                // 두 번째 API 시도 (도착 정보 API에서 위치 추출)
                const url2 = `http://swopenapi.seoul.go.kr/api/subway/${this.arrivalApiKey}/xml/realtimeStationArrival/ALL`;
                const proxyUrl = 'https://api.allorigins.win/raw?url=';
                
                const response2 = await fetch(proxyUrl + encodeURIComponent(url2));
                if (!response2.ok) throw new Error(`Second API HTTP error! status: ${response2.status}`);
                
                const xmlText2 = await response2.text();
                const parser2 = new DOMParser();
                const xmlDoc2 = parser2.parseFromString(xmlText2, 'text/xml');
                
                this.parseAndDisplayPositionFromArrivalData(xmlDoc2, selectedLine, lineName);
                this.updatePositionLastUpdateTime();
            }
            
        } catch (error) {
            console.error('Error loading position data:', error);
            this.positionListEl.innerHTML = '<div class="error-message">위치 정보를 불러올 수 없습니다.</div>';
        } finally {
            this.positionLoadingEl.style.display = 'none';
            this.positionRefreshBtn.disabled = false;
            this.positionRefreshBtn.textContent = '🔄 새로고침';
        }
    }
    
    async loadArrivalData() {
        try {
            this.arrivalLoadingEl.style.display = 'flex';
            this.arrivalListEl.innerHTML = '';
            this.arrivalRefreshBtn.disabled = true;
            this.arrivalRefreshBtn.textContent = '🔄 불러오는 중...';
            
            const url = `http://swopenapi.seoul.go.kr/api/subway/${this.arrivalApiKey}/xml/realtimeStationArrival/ALL`;
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            
            const response = await fetch(proxyUrl + encodeURIComponent(url));
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            
            this.parseAndDisplayArrivalData(xmlDoc);
            this.updateArrivalLastUpdateTime();
            
        } catch (error) {
            console.error('Error loading arrival data:', error);
            this.arrivalListEl.innerHTML = '<div class="error-message">도착 정보를 불러올 수 없습니다.</div>';
        } finally {
            this.arrivalLoadingEl.style.display = 'none';
            this.arrivalRefreshBtn.disabled = false;
            this.arrivalRefreshBtn.textContent = '🔄 새로고침';
        }
    }
    
    getLineCode(lineId) {
        const lineCodes = {
            '1001': '1호선', '1002': '2호선', '1003': '3호선', '1004': '4호선',
            '1005': '5호선', '1006': '6호선', '1007': '7호선', '1008': '8호선',
            '1009': '9호선', '1063': '경의중앙선', '1065': '공항철도', 
            '1067': '경춘선', '1075': '수인분당선', '1077': '신분당선', '1092': '우이신설선'
        };
        return lineCodes[lineId] || '1호선';
    }
    
    parseAndDisplayPositionData(xmlDoc, lineName) {
        const rows = xmlDoc.getElementsByTagName('row');
        
        if (rows.length === 0) {
            this.positionListEl.innerHTML = `<div class="no-data">${lineName} 현재 운행 중인 열차가 없습니다.</div>`;
            return;
        }
        
        const trainData = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const data = {
                trainNo: this.getElementText(row, 'trainNo') || '정보없음',
                statnNm: this.getElementText(row, 'statnNm') || '정보없음',
                updnLine: this.getElementText(row, 'updnLine') || '정보없음',
                trainSttus: this.getElementText(row, 'trainSttus') || '정보없음',
                directAt: this.getElementText(row, 'directAt') || '정보없음',
                lstcarAt: this.getElementText(row, 'lstcarAt') || '정보없음',
                statnTnm: this.getElementText(row, 'statnTnm') || '정보없음'
            };
            trainData.push(data);
        }
        
        this.displayPositionList(trainData, lineName);
    }
    
    parseAndDisplayArrivalData(xmlDoc) {
        const rows = xmlDoc.getElementsByTagName('row');
        
        this.allArrivalData = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const data = {
                subwayId: this.getElementText(row, 'subwayId') || '정보없음',
                statnNm: this.getElementText(row, 'statnNm') || '정보없음',
                trainLineNm: this.getElementText(row, 'trainLineNm') || '정보없음',
                arvlMsg2: this.getElementText(row, 'arvlMsg2') || '정보없음',
                arvlMsg3: this.getElementText(row, 'arvlMsg3') || '정보없음',
                barvlDt: this.getElementText(row, 'barvlDt') || '0',
                btrainNo: this.getElementText(row, 'btrainNo') || '정보없음',
                bstatnNm: this.getElementText(row, 'bstatnNm') || '정보없음',
                updnLine: this.getElementText(row, 'updnLine') || '정보없음',
                lstcarAt: this.getElementText(row, 'lstcarAt') || '0'
            };
            this.allArrivalData.push(data);
        }
        
        this.displayFilteredArrivalList();
    }
    
    displayPositionList(trainData, lineName) {
        if (trainData.length === 0) {
            this.positionListEl.innerHTML = `<div class="no-data">${lineName} 현재 운행 중인 열차가 없습니다.</div>`;
            return;
        }
        
        const html = trainData.map(train => `
            <div class="subway-item position-item">
                <div class="train-header">
                    <div class="train-number">🚇 ${train.trainNo}호</div>
                    <div class="train-status ${this.getStatusClass(train.trainSttus)}">
                        ${this.getStatusText(train.trainSttus)}
                    </div>
                </div>
                <div class="train-info">
                    <div class="info-item">
                        <div class="info-label">현재 위치</div>
                        <div class="info-value station-name">📍 ${train.statnNm}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">운행 방향</div>
                        <div class="info-value direction">🔄 ${this.getDirectionText(train.updnLine)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">종착역</div>
                        <div class="info-value">🏁 ${train.statnTnm}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">열차 구분</div>
                        <div class="info-value">${this.getTrainType(train.directAt, train.lstcarAt)}</div>
                    </div>
                </div>
            </div>
        `).join('');
        
        this.positionListEl.innerHTML = html;
    }
    
    displayArrivalList(arrivalData) {
        if (arrivalData.length === 0) {
            this.arrivalListEl.innerHTML = '<div class="no-data">도착 정보가 없습니다.</div>';
            return;
        }
        
        // 역별로 그룹화하고 각 역에 있는 호선들만 표시
        const stationGroups = {};
        arrivalData.forEach(data => {
            if (!stationGroups[data.statnNm]) {
                stationGroups[data.statnNm] = {};
            }
            if (!stationGroups[data.statnNm][data.subwayId]) {
                stationGroups[data.statnNm][data.subwayId] = [];
            }
            stationGroups[data.statnNm][data.subwayId].push(data);
        });
        
        const html = Object.keys(stationGroups).map(stationName => {
            const lineGroups = stationGroups[stationName];
            const linesHtml = Object.keys(lineGroups).map(subwayId => {
                const lineName = this.lineNames[subwayId] || subwayId;
                const trains = lineGroups[subwayId];
                
                const trainsHtml = trains.map(train => `
                    <div class="arrival-train">
                        <div class="train-direction">${train.trainLineNm}</div>
                        <div class="arrival-status">
                            <span class="arrival-msg">${train.arvlMsg2}</span>
                            <span class="arrival-detail">${train.arvlMsg3}</span>
                        </div>
                        <div class="train-details">
                            <span class="train-no">🚇 ${train.btrainNo}</span>
                            <span class="destination">🏁 ${train.bstatnNm}</span>
                            ${train.lstcarAt === '1' ? '<span class="last-train">🌙 막차</span>' : ''}
                        </div>
                    </div>
                `).join('');
                
                return `
                    <div class="line-group">
                        <div class="line-header">
                            <span class="line-badge line-${subwayId}">${lineName}</span>
                        </div>
                        <div class="trains-in-line">
                            ${trainsHtml}
                        </div>
                    </div>
                `;
            }).join('');
            
            return `
                <div class="subway-item arrival-item">
                    <div class="station-header">
                        <h3>🚉 ${stationName}</h3>
                    </div>
                    <div class="lines-container">
                        ${linesHtml}
                    </div>
                </div>
            `;
        }).join('');
        
        this.arrivalListEl.innerHTML = html;
    }
    
    getElementText(parent, tagName) {
        const element = parent.getElementsByTagName(tagName)[0];
        return element ? element.textContent.trim() : '';
    }
    
    getStatusClass(status) {
        switch(status) {
            case '0': return 'status-entering';
            case '1': return 'status-arrived';
            case '2': return 'status-departed';
            case '3': return 'status-prev-departed';
            default: return 'status-running';
        }
    }
    
    getStatusText(status) {
        switch(status) {
            case '0': return '진입';
            case '1': return '도착';
            case '2': return '출발';
            case '3': return '전역출발';
            default: return '운행중';
        }
    }
    
    getDirectionText(direction) {
        switch(direction) {
            case '0': return '상행/내선';
            case '1': return '하행/외선';
            default: return direction;
        }
    }
    
    getTrainType(directAt, lstcarAt) {
        const types = [];
        if (directAt === '1') types.push('⚡ 급행');
        else if (directAt === '7') types.push('🚄 특급');
        else types.push('🚇 일반');
        
        if (lstcarAt === '1') types.push('🌙 막차');
        
        return types.join(' ');
    }
    
    updatePositionLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ko-KR');
        this.positionLastUpdateEl.textContent = timeString;
    }
    
    updateArrivalLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ko-KR');
        this.arrivalLastUpdateEl.textContent = timeString;
    }
    
    handleStationSearch(searchTerm) {
        const searchResults = document.getElementById('searchResults');
        
        if (!searchTerm.trim()) {
            searchResults.style.display = 'none';
            return;
        }
        
        const stations = this.getUniqueStations();
        const filteredStations = stations.filter(station => 
            station.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => {
            const aIndex = a.toLowerCase().indexOf(searchTerm.toLowerCase());
            const bIndex = b.toLowerCase().indexOf(searchTerm.toLowerCase());
            if (aIndex !== bIndex) return aIndex - bIndex;
            return a.localeCompare(b);
        }).slice(0, 10);
        
        if (filteredStations.length > 0) {
            const html = filteredStations.map(station => 
                `<div class="search-result-item" data-station="${station}">${station}</div>`
            ).join('');
            
            searchResults.innerHTML = html;
            searchResults.style.display = 'block';
            
            searchResults.addEventListener('click', (e) => {
                if (e.target.classList.contains('search-result-item')) {
                    this.selectStation(e.target.dataset.station);
                }
            });
        } else {
            searchResults.innerHTML = '<div class="no-results">검색 결과가 없습니다</div>';
            searchResults.style.display = 'block';
        }
    }
    
    getUniqueStations() {
        const stations = new Set();
        this.allArrivalData.forEach(data => {
            if (data.statnNm && data.statnNm !== '정보없음') {
                stations.add(data.statnNm);
            }
        });
        return Array.from(stations).sort();
    }
    
    selectStation(stationName) {
        this.selectedStation = stationName;
        document.getElementById('stationSearch').value = stationName;
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('selectedStation').style.display = 'block';
        document.getElementById('selectedStationName').textContent = stationName;
        
        this.displayFilteredArrivalList();
    }
    
    clearStationSearch() {
        document.getElementById('stationSearch').value = '';
        document.getElementById('searchResults').style.display = 'none';
        this.selectedStation = null;
        document.getElementById('selectedStation').style.display = 'none';
        
        this.displayFilteredArrivalList();
    }
    
    showAllStations() {
        this.clearStationSearch();
    }
    
    parseAndDisplayPositionFromArrivalData(xmlDoc, selectedLineId, lineName) {
        const rows = xmlDoc.getElementsByTagName('row');
        
        // 선택된 호선의 열차만 필터링
        const lineTrains = [];
        const trainMap = new Map();
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const subwayId = this.getElementText(row, 'subwayId');
            const trainNo = this.getElementText(row, 'btrainNo');
            
            if (subwayId === selectedLineId && trainNo && trainNo !== '정보없음') {
                const key = `${trainNo}_${this.getElementText(row, 'updnLine')}`;
                
                if (!trainMap.has(key)) {
                    const data = {
                        trainNo: trainNo,
                        statnNm: this.getElementText(row, 'statnNm') || '정보없음',
                        updnLine: this.getElementText(row, 'updnLine') || '정보없음',
                        trainSttus: this.getElementText(row, 'arvlCd') || '99',
                        directAt: this.getElementText(row, 'btrainSttus').includes('급행') ? '1' : '0',
                        lstcarAt: this.getElementText(row, 'lstcarAt') || '0',
                        statnTnm: this.getElementText(row, 'bstatnNm') || '정보없음'
                    };
                    trainMap.set(key, data);
                    lineTrains.push(data);
                }
            }
        }
        
        if (lineTrains.length === 0) {
            this.positionListEl.innerHTML = `<div class="no-data">${lineName} 현재 운행 중인 열차가 없습니다.</div>`;
            return;
        }
        
        this.displayPositionList(lineTrains, lineName);
    }

    displayFilteredArrivalList() {
        let filteredData = this.allArrivalData;
        
        // 역 필터링
        if (this.selectedStation) {
            filteredData = filteredData.filter(data => data.statnNm === this.selectedStation);
        }
        
        this.displayArrivalList(filteredData);
    }
}

// 페이지 로드 시 SubwayTracker 초기화
document.addEventListener('DOMContentLoaded', () => {
    new SubwayTracker();
});
