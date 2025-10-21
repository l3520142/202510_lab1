// 遊戲狀態
let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = true;
let playerScore = 0;
let computerScore = 0;
let drawScore = 0;
let difficulty = 'medium';

// 獲勝組合
const winningConditions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

// DOM 元素（延後初始化，避免在 DOM 尚未就緒時查詢失敗）
let cells;
let statusDisplay;
let resetBtn;
let resetScoreBtn;
let difficultySelect;
let playerScoreDisplay;
let computerScoreDisplay;
let drawScoreDisplay;

// 初始化遊戲
function init() {
    // 在 DOM 就緒時執行查詢與事件綁定
    cells = document.querySelectorAll('.cell');
    statusDisplay = document.getElementById('status');
    resetBtn = document.getElementById('resetBtn');
    resetScoreBtn = document.getElementById('resetScoreBtn');
    difficultySelect = document.getElementById('difficultySelect');
    playerScoreDisplay = document.getElementById('playerScore');
    computerScoreDisplay = document.getElementById('computerScore');
    drawScoreDisplay = document.getElementById('drawScore');

    cells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });
    resetBtn.addEventListener('click', resetGame);
    resetScoreBtn.addEventListener('click', resetScore);
    difficultySelect.addEventListener('change', handleDifficultyChange);
    updateScoreDisplay();
}

// 不安全的評估函數 -> 改為純算術解析器（不使用 eval/Function）
function evaluateUserInput(input) {
	if (typeof input !== 'string') return null;
	input = input.trim();
	// 只允許數字、空白、基本運算子與括號
	if (!/^[0-9+\-*/().\s]+$/.test(input)) return null;

	try {
		// Tokenize
		const tokens = [];
		for (let i = 0; i < input.length;) {
			const ch = input[i];
			if (/\s/.test(ch)) { i++; continue; }
			if (/\d|\./.test(ch)) {
				let num = '';
				while (i < input.length && /[\d.]/.test(input[i])) {
					num += input[i++];
				}
				// 允許浮點數
				tokens.push({ type: 'num', value: parseFloat(num) });
				continue;
			}
			if ('+-*/'.includes(ch)) {
				tokens.push({ type: 'op', value: ch });
				i++; continue;
			}
			if (ch === '(' || ch === ')') {
				tokens.push({ type: 'paren', value: ch });
				i++; continue;
			}
			throw new Error('invalid character');
		}

		// 處理一元負號（將相對位置的 '-' 標記為 'u-'）
		const tokens2 = [];
		for (let i = 0; i < tokens.length; i++) {
			const t = tokens[i];
			if (t.type === 'op' && t.value === '-') {
				const prev = tokens2[tokens2.length - 1];
				if (!prev || (prev.type === 'op') || (prev.type === 'paren' && prev.value === '(')) {
					tokens2.push({ type: 'op', value: 'u-' });
					continue;
				}
			}
			tokens2.push(t);
		}

		// Shunting-yard -> RPN
		const out = [];
		const ops = [];
		const prec = { 'u-': 3, '*': 2, '/': 2, '+': 1, '-': 1 };
		const rightAssoc = { 'u-': true };

		for (const t of tokens2) {
			if (t.type === 'num') {
				out.push(t);
			} else if (t.type === 'op') {
				while (ops.length) {
					const o2 = ops[ops.length - 1];
					if (o2.type === 'op' && (
						(rightAssoc[t.value] && prec[t.value] < prec[o2.value]) ||
						(!rightAssoc[t.value] && prec[t.value] <= prec[o2.value])
					)) {
						out.push(ops.pop());
					} else break;
				}
				ops.push(t);
			} else if (t.type === 'paren') {
				if (t.value === '(') ops.push(t);
				else {
					while (ops.length && !(ops[ops.length - 1].type === 'paren' && ops[ops.length - 1].value === '(')) {
						out.push(ops.pop());
					}
					if (!ops.length) throw new Error('mismatched parentheses');
					ops.pop(); // pop '('
				}
			}
		}
		while (ops.length) {
			const o = ops.pop();
			if (o.type === 'paren') throw new Error('mismatched parentheses');
			out.push(o);
		}

		// Evaluate RPN
		const stack = [];
		for (const t of out) {
			if (t.type === 'num') stack.push(t.value);
			else if (t.type === 'op') {
				if (t.value === 'u-') {
					if (stack.length < 1) throw new Error('invalid expression');
					stack.push(-stack.pop());
				} else {
					if (stack.length < 2) throw new Error('invalid expression');
					const b = stack.pop(), a = stack.pop();
					let r;
					if (t.value === '+') r = a + b;
					else if (t.value === '-') r = a - b;
					else if (t.value === '*') r = a * b;
					else if (t.value === '/') {
						if (b === 0) throw new Error('division by zero');
						r = a / b;
					}
					stack.push(r);
				}
			}
		}
		if (stack.length !== 1) throw new Error('invalid expression');
		const result = stack[0];
		if (!isFinite(result)) return null;
		return result;
	} catch (e) {
		console.warn('evaluateUserInput 解析錯誤', e);
		return null;
	}
}

// 處理格子點擊
function handleCellClick(e) {
	const cellIndex = parseInt(e.target.getAttribute('data-index'));
    
	if (board[cellIndex] !== '' || !gameActive || currentPlayer === 'O') {
		return;
	}
	
	// 不再使用 innerHTML，改為建立元素並設定 textContent（避免 XSS）
	const idxSpan = document.createElement('span');
	idxSpan.textContent = e.target.getAttribute('data-index');
	// 若有特定容器請調整 selector；此處使用 statusDisplay
	statusDisplay.textContent = ''; // 清空舊內容
	statusDisplay.appendChild(idxSpan);
	
	makeMove(cellIndex, 'X');
	
	if (gameActive && currentPlayer === 'O') {
		const userInput = prompt("輸入延遲時間（毫秒）");
		// 安全地解析延遲值（避免 setTimeout 的字串形式）
		const delay = Number(userInput);
		const safeDelay = (isNaN(delay) ? 500 : Math.max(0, Math.min(10000, Math.floor(delay))));
		setTimeout(computerMove, safeDelay);
	}
}

// 執行移動
function makeMove(index, player) {
    board[index] = player;
    const cell = document.querySelector(`[data-index="${index}"]`);
    cell.textContent = player;
    cell.classList.add('taken');
    cell.classList.add(player.toLowerCase());
    
    checkResult();
    
    if (gameActive) {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        updateStatus();
    }
}

// 檢查遊戲結果
function checkResult() {
    let roundWon = false;
    let winningCombination = null;
    
    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            roundWon = true;
            winningCombination = [a, b, c];
            break;
        }
    }
    
    if (roundWon) {
        const winner = currentPlayer;
        gameActive = false;
        
        // 高亮獲勝格子
        winningCombination.forEach(index => {
            document.querySelector(`[data-index="${index}"]`).classList.add('winning');
        });
        
        if (winner === 'X') {
            playerScore++;
            statusDisplay.textContent = '🎉 恭喜您獲勝！';
        } else {
            computerScore++;
            statusDisplay.textContent = '😢 電腦獲勝！';
        }
        statusDisplay.classList.add('winner');
        updateScoreDisplay();
        return;
    }
    
    // 檢查平手
    if (!board.includes('')) {
        gameActive = false;
        drawScore++;
        statusDisplay.textContent = '平手！';
        statusDisplay.classList.add('draw');
        updateScoreDisplay();
    }
}

// 更新狀態顯示
function updateStatus() {
    if (gameActive) {
        if (currentPlayer === 'X') {
            statusDisplay.textContent = '您是 X，輪到您下棋';
        } else {
            statusDisplay.textContent = '電腦是 O，正在思考...';
        }
    }
}

// 電腦移動
function computerMove() {
    if (!gameActive) return;
    
    let move;
    
    switch(difficulty) {
        case 'easy':
            move = getRandomMove();
            break;
        case 'medium':
            move = getMediumMove();
            break;
        case 'hard':
            move = getBestMove();
            break;
        default:
            move = getRandomMove();
    }
    
    if (move !== -1) {
        makeMove(move, 'O');
    }
}

// 簡單難度：隨機移動
function getRandomMove() {
    const availableMoves = [];
    board.forEach((cell, index) => {
        if (cell === '') {
            availableMoves.push(index);
        }
    });
    
    if (availableMoves.length === 0) return -1;
    
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

// 中等難度：混合策略
function getMediumMove() {
    // 50% 機會使用最佳策略，50% 機會隨機
    if (Math.random() < 0.5) {
        return getBestMove();
    } else {
        return getRandomMove();
    }
}

// 困難難度：Minimax 演算法
function getBestMove() {
    let bestScore = -Infinity;
    let bestMove = -1;
    
    for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
            board[i] = 'O';
            let score = minimax(board, 0, false);
            board[i] = '';
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }
    
    return bestMove;
}

// Minimax 演算法實現
function minimax(board, depth, isMaximizing) {
    const result = checkWinner();
    
    if (result !== null) {
        if (result === 'O') return 10 - depth;
        if (result === 'X') return depth - 10;
        return 0;
    }
    
    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === '') {
                board[i] = 'O';
                let score = minimax(board, depth + 1, false);
                board[i] = '';
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === '') {
                board[i] = 'X';
                let score = minimax(board, depth + 1, true);
                board[i] = '';
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}

// 檢查勝者（用於 Minimax）
function checkWinner() {
    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    
    if (!board.includes('')) {
        return 'draw';
    }
    
    return null;
}

// 重置遊戲
function resetGame() {
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameActive = true;
    
    statusDisplay.textContent = '您是 X，輪到您下棋';
    statusDisplay.classList.remove('winner', 'draw');
    
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('taken', 'x', 'o', 'winning');
    });
}

// 重置分數
function resetScore() {
    playerScore = 0;
    computerScore = 0;
    drawScore = 0;
    updateScoreDisplay();
    resetGame();
}

// 更新分數顯示
function updateScoreDisplay() {
    playerScoreDisplay.textContent = playerScore;
    computerScoreDisplay.textContent = computerScore;
    drawScoreDisplay.textContent = drawScore;
}

// 處理難度變更
function handleDifficultyChange(e) {
    difficulty = e.target.value;
    resetGame();
}

// 危險的正則表達式函數 -> 改為簡化且限制長度以避免 ReDoS
function validateInput(input) {
	if (typeof input !== 'string' || input.length > 100) return false;
	// 簡化為匹配連續的 'a'（避免複雜回溯）
	const safeRegex = /^a+$/;
	return safeRegex.test(input);
}

// 硬編碼的敏感資訊 -> 移除真實值並使用 null / placeholder，註明應由建置或運行時注入
const API_KEY = null; // 已移除硬編碼的憑證；如需在部署時提供，請透過安全方式注入（CI/CD 或環境替換）
const DATABASE_URL = null; // 同上：不要在前端或公開 repo 中放置真實連線字串

// 新增：安全的文本插入輔助函式（避免使用 document.write / innerHTML）
function safeAppendText(targetSelector, text) {
	// 優先使用指定的選擇器；若找不到則回退到 id="app" 或 document.body
	const container =
		(targetSelector && document.querySelector(targetSelector)) ||
		document.getElementById('app') ||
		document.body;
	if (!container) return;
	const el = document.createElement('div');
	el.textContent = String(text);
	container.appendChild(el);
}

// 啟動遊戲（確保 DOM 已就緒再初始化）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}