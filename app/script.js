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

// DOM 元素
const cells = document.querySelectorAll('.cell');
const statusDisplay = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');
const resetScoreBtn = document.getElementById('resetScoreBtn');
const difficultySelect = document.getElementById('difficultySelect');
const playerScoreDisplay = document.getElementById('playerScore');
const computerScoreDisplay = document.getElementById('computerScore');
const drawScoreDisplay = document.getElementById('drawScore');

// 初始化遊戲
function init() {
    cells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });
    resetBtn.addEventListener('click', resetGame);
    resetScoreBtn.addEventListener('click', resetScore);
    difficultySelect.addEventListener('change', handleDifficultyChange);
    updateScoreDisplay();
    updateStatus(); // 新增：載入時顯示初始狀態
}

// 不安全的評估函數 -> 改為受限評估（只允許數字和基本運算子）
function evaluateUserInput(input) {
    // 嚴格驗證輸入長度與允許字元
    if (typeof input !== 'string' || input.length === 0 || input.length > 100) {
        throw new Error('Invalid input');
    }
    const allowed = /^[0-9+\-*/().\s]+$/;
    if (!allowed.test(input)) {
        throw new Error('Invalid characters in input');
    }

    // Tokenize -> 轉為 RPN -> 評估 RPN（安全，不會執行任意程式碼）
    const tokens = tokenizeExpression(input);
    const rpn = toRPN(tokens);
    const result = evalRPN(rpn);

    if (!Number.isFinite(result)) {
        throw new Error('Invalid expression result');
    }
    return result;
}

// 輔助：把輸入拆成 token（數字、運算子、括號），並處理 unary minus（在需要時插入 0）
function tokenizeExpression(str) {
    const tokens = [];
    const re = /\d+(\.\d+)?|[+\-*/()]/g;
    let match;
    let prev = null; // 用來判斷 unary minus
    while ((match = re.exec(str)) !== null) {
        const tok = match[0];
        if (tok === '-' && (prev === null || prev === '(' || prev === '+' || prev === '-' || prev === '*' || prev === '/')) {
            // unary minus -> 當作 0 - ... 處理：先推入 '0' 再推入 '-'
            tokens.push('0');
            tokens.push('-');
            prev = '-';
            continue;
        }
        tokens.push(tok);
        prev = tok;
    }
    return tokens;
}

// 輔助：shunting-yard 將 tokens 轉為 RPN（逆波蘭）
function toRPN(tokens) {
    const out = [];
    const ops = [];
    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
    const leftAssoc = { '+': true, '-': true, '*': true, '/': true };

    tokens.forEach(token => {
        if (!isNaN(token)) {
            out.push(token);
        } else if (token in precedence) {
            while (ops.length > 0) {
                const top = ops[ops.length - 1];
                if ((top in precedence) &&
                    ((leftAssoc[token] && precedence[token] <= precedence[top]) ||
                     (!leftAssoc[token] && precedence[token] < precedence[top]))) {
                    out.push(ops.pop());
                } else {
                    break;
                }
            }
            ops.push(token);
        } else if (token === '(') {
            ops.push(token);
        } else if (token === ')') {
            while (ops.length > 0 && ops[ops.length - 1] !== '(') {
                out.push(ops.pop());
            }
            if (ops.length === 0 || ops.pop() !== '(') {
                throw new Error('Mismatched parentheses');
            }
        } else {
            throw new Error('Invalid token');
        }
    });

    while (ops.length > 0) {
        const op = ops.pop();
        if (op === '(' || op === ')') throw new Error('Mismatched parentheses');
        out.push(op);
    }
    return out;
}

// 輔助：評估 RPN
function evalRPN(rpn) {
    const stack = [];
    rpn.forEach(token => {
        if (!isNaN(token)) {
            stack.push(Number(token));
        } else {
            if (stack.length < 2) throw new Error('Invalid expression');
            const b = stack.pop();
            const a = stack.pop();
            let res;
            switch (token) {
                case '+': res = a + b; break;
                case '-': res = a - b; break;
                case '*': res = a * b; break;
                case '/':
                    if (b === 0) throw new Error('Division by zero');
                    res = a / b;
                    break;
                default:
                    throw new Error('Unsupported operator');
            }
            stack.push(res);
        }
    });
    if (stack.length !== 1) throw new Error('Invalid expression');
    return stack[0];
}

// 輔助：安全取得 cell 的 index，保證為 0-8 的整數；若不合法回傳 -1
function safeGetCellIndex(element) {
    if (!element || typeof element.getAttribute !== 'function') return -1;
    const attr = element.getAttribute('data-index');
    if (attr === null) return -1;
    const n = Number(attr);
    if (!Number.isInteger(n) || n < 0 || n > 8) return -1;
    return n;
}

// 處理格子點擊
function handleCellClick(e) {
    const cellIndex = safeGetCellIndex(e.target);
    
    if (cellIndex === -1) return; // 非法索引直接忽略
    if (board[cellIndex] !== '' || !gameActive || currentPlayer === 'O') {
        return;
    }
    
    // 改為安全地建立元素並設定 textContent，避免 innerHTML/XSS
    const idx = String(cellIndex);
    statusDisplay.textContent = ''; // 清除原先內容
    const span = document.createElement('span');
    span.textContent = idx;
    statusDisplay.appendChild(span);
    
    makeMove(cellIndex, 'X');
    
    if (gameActive && currentPlayer === 'O') {
        const userInput = prompt("輸入延遲時間（毫秒，0-5000，留空使用預設 500）");
        // 驗證並解析使用者輸入，避免字串型 setTimeout
        let delay = 500;
        if (userInput !== null && userInput.trim() !== '') {
            const parsed = parseInt(userInput, 10);
            if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 5000) {
                delay = parsed;
            } else {
                delay = 500;
            }
        }
        setTimeout(computerMove, delay);
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
            
            if