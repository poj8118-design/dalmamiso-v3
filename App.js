import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, push } from "firebase/database";

/**
 * [달마미소 가계부 v3.0 - 최종 통합 버전]
 * 기능: 실시간 Firebase 연동, 자산 관리, 달력 일정, 통계 차트
 */

// --- Firebase 설정 (기존 설정 유지) ---
const firebaseConfig = {
  apiKey: "AIzaSyAaeIWCMD7_kgFHu8vS_2Vkms1qN0t0kuA",
  authDomain: "dalmamiso-account.firebaseapp.com",
  projectId: "dalmamiso-account",
  storageBucket: "dalmamiso-account.firebasestorage.app",
  messagingSenderId: "800152094837",
  appId: "1:800152094837:web:5557fc7804ca6a86cc903c",
  databaseURL: "https://dalmamiso-account-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const App = () => {
  const [accounts, setAccounts] = useState({
    '국민은행': 0, '농협': 0, '신한은행': 0, '신협': 0, '우체국': 0, '현금': 0
  });
  const [items, setItems] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [todayAlert, setTodayAlert] = useState(null);
  const [filter, setFilter] = useState('전체');
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: '지출', account: '국민은행', category: '변동지출', subCategory: '식비', memo: '', amount: ''
  });

  const categories = {
    '수입': ['인건비', '용돈', '기타', '월급', '부수입'],
    '고정지출': ['주거/통신', '보험/세금', '구독/회비'],
    '변동지출': ['자재비', '인건비', '식비', '교통/차량', '생활/쇼핑', '기타'],
    '저축/투자': ['예적금', '주식/채권', '연금']
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // --- 실시간 데이터 동기화 ---
  useEffect(() => {
    onValue(ref(db, 'accounts'), (snap) => snap.exists() && setAccounts(snap.val()));
    onValue(ref(db, 'items'), (snap) => {
      if (snap.exists()) {
        const data = Object.values(snap.val());
        setItems(data.reverse());
      }
    });
    onValue(ref(db, 'schedules'), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setSchedules(data);
        if (data[todayStr]) setTodayAlert({ title: data[todayStr] });
      }
    });
  }, [todayStr]);

  // --- 데이터 저장 및 로직 ---
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.memo) return alert('내용과 금액을 입력하세요!');
    const amt = parseInt(formData.amount);
    
    const newAccounts = {
      ...accounts,
      [formData.account]: formData.type === '수입' ? accounts[formData.account] + amt : accounts[formData.account] - amt
    };

    set(ref(db, 'accounts'), newAccounts);
    push(ref(db, 'items'), { ...formData, amount: amt, id: Date.now() });
    setFormData({ ...formData, memo: '', amount: '' });
  };

  const updateSchedule = (dateStr, title) => {
    const next = { ...schedules };
    if (!title || title.trim() === "") delete next[dateStr];
    else next[dateStr] = title;
    set(ref(db, 'schedules'), next);
  };

  const handleCategoryChange = (cat) => {
    setFormData({ ...formData, category: cat, subCategory: categories[cat][0] });
  };

  // --- 필터 및 통계 계산 ---
  const filteredItems = useMemo(() => {
    const now = new Date();
    return items.filter(item => {
      const itemDate = new Date(item.date);
      if (filter === '주간') {
        const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
        return itemDate >= weekAgo;
      } else if (filter === '월간') {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      } else if (filter === '연간') return itemDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [items, filter]);

  const stats = useMemo(() => {
    const getMap = (arr) => {
      const map = {};
      arr.forEach(i => { map[i.subCategory] = (map[i.subCategory] || 0) + i.amount; });
      return map;
    };
    const inc = filteredItems.filter(i => i.type === '수입');
    const exp = filteredItems.filter(i => i.type === '지출');
    return {
      incomeMap: getMap(inc), expenseMap: getMap(exp),
      totalIncome: inc.reduce((a, b) => a + b.amount, 0),
      totalExpense: exp.reduce((a, b) => a + b.amount, 0)
    };
  }, [filteredItems]);

  return (
    <div style={containerStyle}>
      {/* 팝업 알림 */}
      {todayAlert && (
        <div style={modalOverlayStyle}>
          <div style={alertPopupStyle}>
            <div style={{fontSize: '2.5rem'}}>🔔</div>
            <h3 style={{color: '#f39c12'}}>오늘의 일정</h3>
            <p style={{fontWeight: 'bold', margin: '20px 0'}}>{todayAlert.title}</p>
            <button style={popupCloseBtnStyle} onClick={() => setTodayAlert(null)}>확인</button>
          </div>
        </div>
      )}

      {/* 달력 모달 */}
      {showCalendar && (
        <div style={modalOverlayStyle}>
          <CalendarModal schedules={schedules} onUpdate={updateSchedule} onClose={() => setShowCalendar(false)} />
        </div>
      )}

      <div style={hamburgerStyle} onClick={() => setIsMenuOpen(true)}>☰</div>

      {/* 사이드바 메뉴 */}
      {isMenuOpen && (
        <>
          <div style={overlayStyle} onClick={() => setIsMenuOpen(false)} />
          <div style={sidebarStyle}>
            <div style={sidebarHeaderStyle}>
              <h2 style={{color: '#f39c12', margin: 0}}>Menu</h2>
              <span style={{cursor: 'pointer'}} onClick={() => setIsMenuOpen(false)}>×</span>
            </div>
            <div style={menuListStyle}>
              <div style={menuItemStyle} onClick={() => {setShowCalendar(true); setIsMenuOpen(false);}}>📅 일정 추가 (달력)</div>
              <div style={menuItemStyle} onClick={() => alert('실시간 동기화 중입니다.')}>✅ 동기화 활성화됨</div>
              <div style={menuItemStyle} onClick={() => setIsMenuOpen(false)}>💰 계좌 관리</div>
            </div>
          </div>
        </>
      )}

      <header style={headerStyle}><h1 style={titleStyle}>달마미소 종합 가계부</h1></header>

      {/* 잔액 대시보드 */}
      <div style={accountGridStyle}>
        {Object.entries(accounts).map(([name, balance]) => (
          <div key={name} style={accountCardStyle} onClick={() => {
            const val = prompt(`${name} 잔액 수정:`, balance);
            if (val !== null) set(ref(db, `accounts/${name}`), parseInt(val));
          }}>
            <div style={accountNameStyle}>{name} ⚙️</div>
            <div style={accountBalanceStyle}>{balance.toLocaleString()}원</div>
          </div>
        ))}
      </div>

      {/* 일정 바 */}
      <div style={todayScheduleBarStyle}>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <span style={{fontSize: '1.1rem'}}>📅</span>
          <span style={{color: '#f39c12', fontWeight: 'bold', fontSize: '0.9rem'}}>오늘의 일정:</span>
        </div>
        <div style={{flex: 1, color: '#fff', fontSize: '0.9rem', textAlign: 'right', fontWeight: '500'}}>
          {schedules[todayStr] ? schedules[todayStr] : "일정이 없습니다."}
        </div>
      </div>

      {/* 통계 섹션 */}
      <div style={statsSectionStyle}>
        <div style={filterMenuStyle}>
          {['전체', '주간', '월간', '연간'].map(m => (
            <button key={m} onClick={() => setFilter(m)} style={filterBtnStyle(filter === m)}>{m}</button>
          ))}
        </div>
        <div style={chartsWrapperStyle}>
          <div style={chartBoxStyle}>
            <h4 style={{color:'#2ecc71', fontSize:'0.8rem'}}>수입 (%)</h4>
            {stats.totalIncome > 0 ? <PieChart data={stats.incomeMap} total={stats.totalIncome} type="income" /> : <div style={emptyTextStyle}>내역 없음</div>}
          </div>
          <div style={chartBoxStyle}>
            <h4 style={{color:'#e74c3c', fontSize:'0.8rem'}}>지출 (%)</h4>
            {stats.totalExpense > 0 ? <PieChart data={stats.expenseMap} total={stats.totalExpense} type="expense" /> : <div style={emptyTextStyle}>내역 없음</div>}
          </div>
        </div>
      </div>

      {/* 입력 폼 */}
      <div style={formContainerStyle}>
        <form onSubmit={handleSubmit}>
          <div style={inputGroupStyle}>
            <select style={inputStyle} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
              <option value="지출">지출</option><option value="수입">수입</option>
            </select>
            <select style={inputStyle} value={formData.account} onChange={e => setFormData({...formData, account: e.target.value})}>
              {Object.keys(accounts).map(acc => <option key={acc} value={acc}>{acc}</option>)}
            </select>
            <input type="date" style={inputStyle} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
          </div>
          <div style={{...inputGroupStyle, marginTop: '10px'}}>
            <select style={inputStyle} value={formData.category} onChange={e => handleCategoryChange(e.target.value)}>
              {Object.keys(categories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select style={inputStyle} value={formData.subCategory} onChange={e => setFormData({...formData, subCategory: e.target.value})}>
              {categories[formData.category].map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
            <input placeholder="금액" type="number" style={inputStyle} value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
          </div>
          <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
            <input placeholder="메모 입력" style={{...inputStyle, flex: 1}} value={formData.memo} onChange={e => setFormData({...formData, memo: e.target.value})} />
            <button type="submit" style={buttonStyle}>저장하기</button>
          </div>
        </form>
      </div>

      {/* 내역 리스트 */}
      <div style={listContainerStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={tableHeaderRowStyle}><th style={thStyle}>날짜</th><th style={thStyle}>분류/메모</th><th style={thRightStyle}>금액</th></tr></thead>
          <tbody>
            {filteredItems.map(item => (
              <tr key={item.id} style={tableRowStyle}>
                <td style={tdStyle}>{item.date}</td>
                <td style={tdStyle}>
                  <div style={{fontSize:'0.7rem', color:'#888'}}>{item.category} &gt; {item.subCategory}</div>
                  <strong>{item.memo}</strong>
                </td>
                <td style={tdRightStyle(item.type)}>{item.type === '수입' ? '+' : '-'}{item.amount.toLocaleString()}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer style={footerStyle}>
        자산 합계: <span style={{color: '#f39c12'}}>{Object.values(accounts).reduce((a,b)=>a+b,0).toLocaleString()}원</span>
      </footer>
    </div>
  );
};

// --- 하위 컴포넌트 ---

const CalendarModal = ({ schedules, onUpdate, onClose }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  
  const handleDayClick = (day) => {
    const dStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const title = prompt(`${dStr} 일정 입력:`, schedules[dStr] || "");
    if (title !== null) onUpdate(dStr, title);
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} />);
  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    cells.push(<div key={i} style={dayBoxStyle(schedules[dStr])} onClick={() => handleDayClick(i)}>{i} {schedules[dStr] && <div style={dotStyle} />}</div>);
  }

  return (
    <div style={calendarCardStyle}>
      <div style={calHeaderStyle}>
        <button style={calBtnStyle} onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))}>◀</button>
        <span>{viewDate.getFullYear()}년 {viewDate.getMonth()+1}월</span>
        <button style={calBtnStyle} onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))}>▶</button>
      </div>
      <div style={calGridStyle}>{cells}</div>
      <button style={{...popupCloseBtnStyle, marginTop: '20px'}} onClick={onClose}>달력 닫기</button>
    </div>
  );
};

const PieChart = ({ data, total, type }) => {
  let acc = 0;
  const colors = type === 'income' ? ['#2ecc71', '#3498db', '#1abc9c'] : ['#e74c3c', '#f39c12', '#d35400'];
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'10px'}}>
      <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)', width: '60px', height: '60px' }}>
        {Object.entries(data).map(([cat, val], i) => {
          const start = [Math.cos(2 * Math.PI * acc), Math.sin(2 * Math.PI * acc)];
          acc += val / total;
          const end = [Math.cos(2 * Math.PI * acc), Math.sin(2 * Math.PI * acc)];
          return <path key={cat} d={`M 0 0 L ${start[0]} ${start[1]} A 1 1 0 ${val/total > 0.5 ? 1 : 0} 1 ${end[0]} ${end[1]} Z`} fill={colors[i % colors.length]} />;
        })}
      </svg>
      <div style={{fontSize:'0.6rem', color:'#aaa', textAlign:'left'}}>
        {Object.entries(data).slice(0, 3).map(([cat, val]) => <div key={cat}>{cat.substring(0,4)}: {((val/total)*100).toFixed(0)}%</div>)}
      </div>
    </div>
  );
};

// --- 스타일 정의 (전체 통합) ---
const containerStyle = { backgroundColor: '#1a1c20', minHeight: '100vh', padding: '20px', color: '#e0e0e0', fontFamily: 'sans-serif', position: 'relative' };
const hamburgerStyle = { position: 'absolute', top: '22px', left: '20px', fontSize: '1.8rem', cursor: 'pointer', color: '#f39c12', zIndex: 10 };
const todayScheduleBarStyle = { backgroundColor: '#2c2f36', padding: '12px 20px', borderRadius: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #f39c12' };
const overlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 20 };
const sidebarStyle = { position: 'fixed', top: 0, left: 0, width: '260px', height: '100%', backgroundColor: '#2c2f36', padding: '20px', zIndex: 30, boxShadow: '2px 0 15px rgba(0,0,0,0.5)' };
const sidebarHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #444', paddingBottom: '10px' };
const menuListStyle = { display: 'flex', flexDirection: 'column', gap: '15px' };
const menuItemStyle = { padding: '12px', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#3d414a', fontSize: '0.9rem' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 };
const alertPopupStyle = { backgroundColor: '#fff', color: '#333', padding: '30px', borderRadius: '25px', textAlign: 'center', width: '300px' };
const popupCloseBtnStyle = { backgroundColor: '#f39c12', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', width: '100%' };
const calendarCardStyle = { backgroundColor: '#2c2f36', padding: '20px', borderRadius: '20px', width: '320px' };
const calHeaderStyle = { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' };
const calBtnStyle = { background: 'none', border: 'none', color: '#f39c12', cursor: 'pointer', fontSize: '1rem' };
const calGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' };
const dayBoxStyle = (active) => ({ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: active ? '#f39c12' : '#3d414a', borderRadius: '8px', cursor: 'pointer', position: 'relative', fontSize: '0.8rem' });
const dotStyle = { position: 'absolute', bottom: '4px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#fff' };
const headerStyle = { textAlign: 'center', marginBottom: '20px' };
const titleStyle = { color: '#f39c12', fontSize: '1.8rem', fontWeight: '900' };
const accountGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '25px' };
const accountCardStyle = { backgroundColor: '#fff', borderRadius: '12px', padding: '12px', textAlign: 'center', color: '#333', cursor: 'pointer' };
const accountNameStyle = { color: '#888', fontSize: '0.7rem', fontWeight: 'bold' };
const accountBalanceStyle = { fontSize: '0.9rem', fontWeight: '900' };
const statsSectionStyle = { backgroundColor: '#2c2f36', padding: '15px', borderRadius: '16px', marginBottom: '20px' };
const filterMenuStyle = { display: 'flex', gap: '8px', marginBottom: '15px', justifyContent: 'center' };
const filterBtnStyle = (active) => ({ padding: '6px 12px', borderRadius: '12px', border: 'none', backgroundColor: active ? '#f39c12' : '#3d414a', color: '#fff', fontSize: '0.75rem' });
const chartsWrapperStyle = { display: 'flex', gap: '10px' };
const chartBoxStyle = { flex: 1, backgroundColor: '#343842', padding: '12px', borderRadius: '12px', textAlign: 'center' };
const emptyTextStyle = { fontSize: '0.7rem', color: '#555', padding: '10px' };
const formContainerStyle = { backgroundColor: '#2c2f36', padding: '20px', borderRadius: '16px', marginBottom: '25px' };
const inputStyle = { backgroundColor: '#3d414a', border: 'none', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', outline: 'none', width: '100%', boxSizing: 'border-box' };
const inputGroupStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' };
const buttonStyle = { backgroundColor: '#2980b9', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const listContainerStyle = { backgroundColor: '#2c2f36', borderRadius: '16px', overflow: 'hidden' };
const tableHeaderRowStyle = { backgroundColor: '#3d414a', color: '#aaa' };
const thStyle = { padding: '12px', textAlign: 'left', fontSize: '0.8rem' };
const thRightStyle = { padding: '12px', textAlign: 'right', fontSize: '0.8rem' };
const tableRowStyle = { borderBottom: '1px solid #3d414a' };
const tdStyle = { padding: '12px', fontSize: '0.85rem' };
const tdRightStyle = (type) => ({ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: type === '수입' ? '#2ecc71' : '#e74c3c' });
const footerStyle = { marginTop: '25px', textAlign: 'right', fontSize: '1.2rem', fontWeight: 'bold' };

export default App;
