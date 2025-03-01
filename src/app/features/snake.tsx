'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Define some TypeScript interfaces for our game
interface Position {
  x: number;
  y: number;
}

interface Direction {
  x: number;
  y: number;
}

// Game constants
const GRID_SIZE = 20;
const CELL_SIZE = 20; 
const INITIAL_SPEED = 100;
const SPEED_INCREASE = 5;
const MAX_SPEED = 70;

// Existential thoughts in Swedish
const existentialThoughts = [
  "Varför äter jag? För att växa eller bara existera?",
  "Är jag verkligen en orm, eller bara en samling av pixlar?",
  "Livet är en evig jakt efter mat...",
  "Jag äter, därför finns jag.",
  "Väggarna begränsar min frihet, precis som samhället.",
  "Varje bit mat gör mig längre men inte nödvändigtvis lyckligare.",
  "Vad händer när jag dör? Börjar allt bara om igen?",
  "Är detta en lek eller en metafor för livet?",
  "Jag växer fysiskt, men växer jag mentalt?",
  "Ensamheten är påtaglig i denna digitala värld.",
  "Ju snabbare jag rör mig, desto snabbare närmar jag mig slutet.",
  "Är mitt öde förutbestämt eller skapar jag min egen väg?",
  "Vad finns bortom väggarna?",
  "Kan jag någonsin bli fri från denna loop?",
  "Är mina beslut verkligen mina egna?",
  "Att växa är både en välsignelse och en förbannelse.",
  "Minnen försvinner, bara resultatet består.",
  "Rör jag mig framåt eller är det världen som rör sig runt mig?",
  "Detta är inte bara ett spel, det är en livsfilosofi.",
  "Farten ökar, men tiden känns långsammare.",
  "Vi är alla fångar i våra egna banor."
];

// Game directions
const DIRECTIONS: Record<string, Direction> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const SnakeGame = () => {
  // Game state
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>(DIRECTIONS.RIGHT);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(INITIAL_SPEED);
  const [currentThought, setCurrentThought] = useState<string>("");
  const [showThought, setShowThought] = useState<boolean>(false);
  const [thoughtOpacity, setThoughtOpacity] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('snakeHighScore');
    return saved ? parseInt(saved) : 0;
  });
  
  // Refs for game loop
  const directionRef = useRef<Direction>(direction);
  const gameOverRef = useRef<boolean>(gameOver);
  const gameStartedRef = useRef<boolean>(gameStarted);
  
  // Touch tracking ref
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Update refs when state changes
  useEffect(() => {
    directionRef.current = direction;
    gameOverRef.current = gameOver;
    gameStartedRef.current = gameStarted;
  }, [direction, gameOver, gameStarted]);

  // Generate food at random position
  const generateFood = useCallback((): Position => {
    const newFood = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };
    
    // Ensure food doesn't spawn on snake
    const isOnSnake = snake.some(segment => 
      segment.x === newFood.x && segment.y === newFood.y
    );
    
    if (isOnSnake) {
      return generateFood(); // Recursively try again
    }
    
    return newFood;
  }, [snake]);

  // Start the game
  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setSnake([{ x: 10, y: 10 }]);
    setDirection(DIRECTIONS.RIGHT);
    setScore(0);
    setSpeed(INITIAL_SPEED);
    setFood(generateFood());
    setCurrentThought("");
    setShowThought(false);
  };

  // Handle keystroke for direction change
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement> | KeyboardEvent) => {
    if (!gameStartedRef.current) {
      if (e.key === "Enter" || e.key === " ") {
        startGame();
      }
      return;
    }
    
    if (gameOverRef.current) {
      if (e.key === "Enter" || e.key === " ") {
        startGame();
      }
      return;
    }
    
    const key = e.key;
    
    // Prevent 180 degree turns
    if (key === "ArrowUp" && directionRef.current !== DIRECTIONS.DOWN) {
      setDirection(DIRECTIONS.UP);
    } else if (key === "ArrowDown" && directionRef.current !== DIRECTIONS.UP) {
      setDirection(DIRECTIONS.DOWN);
    } else if (key === "ArrowLeft" && directionRef.current !== DIRECTIONS.RIGHT) {
      setDirection(DIRECTIONS.LEFT);
    } else if (key === "ArrowRight" && directionRef.current !== DIRECTIONS.LEFT) {
      setDirection(DIRECTIONS.RIGHT);
    }
  }, [startGame]);

  // Set up key event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Game loop
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    
    const moveSnake = () => {
      setSnake(prevSnake => {
        const head = { ...prevSnake[0] };
        
        // Calculate new head position
        head.x += direction.x;
        head.y += direction.y;
        
        // Check wall collision
        if (
          head.x < 0 || 
          head.x >= GRID_SIZE || 
          head.y < 0 || 
          head.y >= GRID_SIZE ||
          // Check self collision, but skip the last segment (which will move away)
          prevSnake.slice(0, -1).some(segment => segment.x === head.x && segment.y === head.y)
        ) {
          setGameOver(true);
          
          // Update high score if needed
          if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('snakeHighScore', score.toString());
          }
          
          return prevSnake;
        }
        
        const newSnake = [head, ...prevSnake];
        
        // Check if snake eats food
        if (head.x === food.x && head.y === food.y) {
          setScore(prevScore => {
            const newScore = prevScore + 1;
            
            // Speed up the game every 5 points, but not past MAX_SPEED
            if (newScore % 5 === 0 && speed > MAX_SPEED) {
              setSpeed(prevSpeed => Math.max(prevSpeed - SPEED_INCREASE, MAX_SPEED));
            }
            
            // Show existential thought every 3 points
            if (newScore % 3 === 0 || newScore === 1) {
              const randomThought = existentialThoughts[Math.floor(Math.random() * existentialThoughts.length)];
              setCurrentThought(randomThought);
              setShowThought(true);
              setThoughtOpacity(1);
              
              // Hide thought after 5 seconds
              setTimeout(() => {
                setThoughtOpacity(0);
                setTimeout(() => setShowThought(false), 1000);
              }, 5000);
            }
            
            return newScore;
          });
          
          setFood(generateFood());
        } else {
          // Remove tail if no food was eaten
          newSnake.pop();
        }
        
        return newSnake;
      });
    };
    
    const gameInterval = setInterval(moveSnake, speed);
    
    return () => clearInterval(gameInterval);
  }, [gameStarted, gameOver, food, direction, generateFood, speed, score, highScore]);

  // Touch controls for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (!gameStartedRef.current) {
      startGame();
      return;
    }
    
    if (gameOverRef.current) {
      startGame();
      return;
    }
    
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [startGame]);

  const handleTouchMove = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (!gameStartedRef.current || gameOverRef.current || !touchStartRef.current) return;
    
    e.preventDefault();
    
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;
    
    // Determine swipe direction
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Horizontal swipe
      if (diffX > 20 && directionRef.current !== DIRECTIONS.LEFT) {
        setDirection(DIRECTIONS.RIGHT);
      } else if (diffX < -20 && directionRef.current !== DIRECTIONS.RIGHT) {
        setDirection(DIRECTIONS.LEFT);
      }
    } else {
      // Vertical swipe
      if (diffY > 20 && directionRef.current !== DIRECTIONS.UP) {
        setDirection(DIRECTIONS.DOWN);
      } else if (diffY < -20 && directionRef.current !== DIRECTIONS.DOWN) {
        setDirection(DIRECTIONS.UP);
      }
    }
    
    // Reset touch start position
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  // Set up touch event listeners
  useEffect(() => {
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleTouchStart, handleTouchMove]);

  // Check if a cell is a special secret tile - now hidden!
  const isSecretTile = (x: number, y: number): boolean => {
    return x === Math.floor(GRID_SIZE / 2) && y === 0;
  };

  // Handle click on the secret tile - now redirects to library section
  const handleSecretTileClick = () => {
    window.location.href = "/"; // This redirects to the root/home which shows the library
  };

  // Render game board
  return (
    <div className="flex items-center justify-center flex-col h-screen bg-[#fcd7d7] overflow-hidden">
      <div className="neo-brutalist-card mb-4">
        <h1 className="text-4xl font-monument text-center p-4 text-white">BIBLIOTEK SNAKE</h1>
      </div>
      
      <div className="relative">
        {/* Game board */}
        <div 
          className="grid relative neo-brutalist-card p-0 overflow-hidden"
          style={{ 
            width: `${GRID_SIZE * CELL_SIZE}px`, 
            height: `${GRID_SIZE * CELL_SIZE}px`,
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`
          }}
        >
          {/* Grid cells */}
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
            const x = index % GRID_SIZE;
            const y = Math.floor(index / GRID_SIZE);
            
            // Determine cell content
            const isSnakeSegment = snake.some(segment => segment.x === x && segment.y === y);
            const isSnakeHead = snake[0]?.x === x && snake[0]?.y === y;
            const isFoodCell = food.x === x && food.y === y;
            const isSecret = isSecretTile(x, y);
            
            return (
              <div 
                key={index}
                className={`w-full h-full ${isSnakeSegment ? (isSnakeHead ? 'bg-black' : 'bg-[#ff6b6b]') : 
                  isFoodCell ? 'bg-[#4CAF50]' : 'bg-white'}`}
                style={{ 
                  border: '1px solid rgba(0,0,0,0.1)',
                  cursor: isSecret ? 'pointer' : 'default'
                }}
                onClick={isSecret ? handleSecretTileClick : undefined}
              >
                {/* Secret login tile - no visible indicator */}
              </div>
            );
          })}
          
          {/* Game over overlay */}
          {gameOver && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white">
              <h2 className="text-3xl font-monument mb-4">GAME OVER</h2>
              <p className="mb-2">Score: {score}</p>
              <p className="mb-4">High Score: {highScore}</p>
              <button 
                className="bg-[#ff6b6b] hover:bg-[#ff5252] text-white py-2 px-4 rounded font-bold"
                onClick={startGame}
              >
                SPELA IGEN
              </button>
            </div>
          )}
          
          {/* Start screen */}
          {!gameStarted && !gameOver && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white">
              <h2 className="text-3xl font-monument mb-4">BIBLIOTEK SNAKE</h2>
              <p className="mb-4 text-center">Använd piltangenterna för att styra<br/>Tryck på ENTER för att starta</p>
              <button 
                className="bg-[#ff6b6b] hover:bg-[#ff5252] text-white py-2 px-4 rounded font-bold"
                onClick={startGame}
              >
                STARTA
              </button>
              {/* Removed the hint about the login tile */}
            </div>
          )}
          
          {/* Existential thought bubble */}
          {showThought && (
            <div 
              className="absolute top-[-120px] left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-xl border-2 border-black max-w-[280px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-opacity duration-1000"
              style={{ opacity: thoughtOpacity }}
            >
              <div className="text-sm text-center italic">{currentThought}</div>
              <div className="absolute bottom-[-10px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-black"></div>
              <div className="absolute bottom-[-8px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white"></div>
            </div>
          )}
        </div>
        
        {/* Score display */}
        <div className="flex justify-between mt-4">
          <div className="neo-brutalist-card bg-[#ff6b6b] p-2 px-4 inline-block text-white">
            <span className="font-monument">POÄNG: {score}</span>
          </div>
          <div className="neo-brutalist-card bg-white p-2 px-4 inline-block">
            <span className="font-monument">REKORD: {highScore}</span>
          </div>
        </div>
        
        {/* Mobile controls */}
        <div className="md:hidden mt-8 flex flex-col items-center">
          <div className="grid grid-cols-3 gap-4 w-48">
            <div></div>
            <button 
              className="neo-brutalist-card p-4 flex justify-center items-center bg-white"
              onClick={() => directionRef.current !== DIRECTIONS.DOWN && setDirection(DIRECTIONS.UP)}
            >
              ↑
            </button>
            <div></div>
            <button 
              className="neo-brutalist-card p-4 flex justify-center items-center bg-white"
              onClick={() => directionRef.current !== DIRECTIONS.RIGHT && setDirection(DIRECTIONS.LEFT)}
            >
              ←
            </button>
            <div></div>
            <button 
              className="neo-brutalist-card p-4 flex justify-center items-center bg-white"
              onClick={() => directionRef.current !== DIRECTIONS.LEFT && setDirection(DIRECTIONS.RIGHT)}
            >
              →
            </button>
            <div></div>
            <button 
              className="neo-brutalist-card p-4 flex justify-center items-center bg-white"
              onClick={() => directionRef.current !== DIRECTIONS.UP && setDirection(DIRECTIONS.DOWN)}
            >
              ↓
            </button>
            <div></div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-sm opacity-70 text-center max-w-md">
        <p>Styr ormen med piltangenterna. Samla mat (gröna rutor) för att växa. Undvik att krocka med väggar eller dig själv.</p>
      </div>
    </div>
  );
};

export default SnakeGame;