import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Target, RotateCcw, Play, Pause } from "lucide-react";

interface Character {
  id: string;
  x: number;
  y: number;
  isGoofy: boolean;
  isFound: boolean;
  emoji: string;
}

interface GameState {
  score: number;
  timeLeft: number;
  gameStarted: boolean;
  gameOver: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  level: number;
}

const GAME_DURATION = 60; // 60 seconds per level
const DIFFICULTIES = {
  easy: { totalCharacters: 20, goofyCount: 3 },
  medium: { totalCharacters: 40, goofyCount: 5 },
  hard: { totalCharacters: 60, goofyCount: 7 }
};

const CHARACTER_EMOJIS = ['👤', '🧑', '👩', '👨', '🧓', '👱', '👴', '👵', '🧑‍🦲', '👨‍🦱'];
const GOOFY_EMOJI = '🤪'; // Goofy character

export default function FindGoofyGame() {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    timeLeft: GAME_DURATION,
    gameStarted: false,
    gameOver: false,
    difficulty: 'medium',
    level: 1
  });

  const [characters, setCharacters] = useState<Character[]>([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scopeVisible, setScopeVisible] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('findGoofyHighScore') || '0');
  });

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  // Generate random characters for the level
  const generateCharacters = useCallback((difficulty: string, level: number) => {
    const config = DIFFICULTIES[difficulty as keyof typeof DIFFICULTIES];
    const totalCharacters = Math.min(config.totalCharacters + (level - 1) * 5, 80);
    const goofyCount = Math.min(config.goofyCount + Math.floor((level - 1) / 2), 12);
    
    const newCharacters: Character[] = [];
    
    // Add Goofy characters
    for (let i = 0; i < goofyCount; i++) {
      newCharacters.push({
        id: `goofy-${i}`,
        x: Math.random() * 85 + 5, // 5% to 90% to avoid edges
        y: Math.random() * 75 + 15, // 15% to 90% to avoid HUD
        isGoofy: true,
        isFound: false,
        emoji: GOOFY_EMOJI
      });
    }
    
    // Add regular characters
    for (let i = 0; i < totalCharacters - goofyCount; i++) {
      newCharacters.push({
        id: `char-${i}`,
        x: Math.random() * 85 + 5,
        y: Math.random() * 75 + 15,
        isGoofy: false,
        isFound: false,
        emoji: CHARACTER_EMOJIS[Math.floor(Math.random() * CHARACTER_EMOJIS.length)]
      });
    }
    
    return newCharacters;
  }, []);

  // Start new game
  const startGame = useCallback(() => {
    const newCharacters = generateCharacters(gameState.difficulty, gameState.level);
    setCharacters(newCharacters);
    setGameState(prev => ({
      ...prev,
      gameStarted: true,
      gameOver: false,
      timeLeft: GAME_DURATION
    }));
    setScopeVisible(true);
    
    // Start timer
    timerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.timeLeft <= 1) {
          clearInterval(timerRef.current);
          return { ...prev, timeLeft: 0, gameOver: true };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    toast({
      title: "Mission Started!",
      description: `Find all the Goofy characters! Level ${gameState.level}`,
    });
  }, [gameState.difficulty, gameState.level, generateCharacters]);

  // Handle character click
  const handleCharacterClick = useCallback((characterId: string) => {
    if (!gameState.gameStarted || gameState.gameOver) return;

    setCharacters(prev => prev.map(char => {
      if (char.id === characterId && !char.isFound) {
        if (char.isGoofy) {
          // Found Goofy!
          setGameState(prevState => ({
            ...prevState,
            score: prevState.score + (100 * prevState.level)
          }));
          
          toast({
            title: "Target Acquired! 🎯",
            description: `+${100 * gameState.level} points!`,
          });
          
          return { ...char, isFound: true };
        } else {
          // Wrong target
          setGameState(prevState => ({
            ...prevState,
            score: Math.max(0, prevState.score - 25)
          }));
          
          toast({
            title: "Wrong Target! ❌",
            description: "-25 points",
            variant: "destructive"
          });
        }
      }
      return char;
    }));
  }, [gameState.gameStarted, gameState.gameOver, gameState.level]);

  // Check for level completion
  useEffect(() => {
    if (!gameState.gameStarted || gameState.gameOver) return;
    
    const allGoofysFound = characters.length > 0 && 
      characters.filter(char => char.isGoofy).every(char => char.isFound);
    
    if (allGoofysFound) {
      clearInterval(timerRef.current);
      
      // Bonus points for time remaining
      const timeBonus = gameState.timeLeft * 10;
      const newScore = gameState.score + timeBonus;
      
      setGameState(prev => ({
        ...prev,
        score: newScore,
        level: prev.level + 1,
        gameOver: true
      }));
      
      // Check for high score
      if (newScore > highScore) {
        setHighScore(newScore);
        localStorage.setItem('findGoofyHighScore', newScore.toString());
      }
      
      toast({
        title: "Level Complete! 🏆",
        description: `Time bonus: +${timeBonus} points! Next level unlocked.`,
      });
    }
  }, [characters, gameState.gameStarted, gameState.gameOver, gameState.timeLeft, gameState.score, highScore]);

  // Game over effect
  useEffect(() => {
    if (gameState.gameOver) {
      setScopeVisible(false);
      clearInterval(timerRef.current);
      
      if (gameState.timeLeft === 0) {
        toast({
          title: "Mission Failed! ⏰",
          description: "Time's up! Try again?",
          variant: "destructive"
        });
      }
    }
  }, [gameState.gameOver, gameState.timeLeft]);

  // Mouse tracking for scope
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    clearInterval(timerRef.current);
    setGameState({
      score: 0,
      timeLeft: GAME_DURATION,
      gameStarted: false,
      gameOver: false,
      difficulty: gameState.difficulty,
      level: 1
    });
    setCharacters([]);
    setScopeVisible(false);
  }, [gameState.difficulty]);

  // Continue to next level
  const nextLevel = useCallback(() => {
    const newCharacters = generateCharacters(gameState.difficulty, gameState.level);
    setCharacters(newCharacters);
    setGameState(prev => ({
      ...prev,
      gameStarted: true,
      gameOver: false,
      timeLeft: GAME_DURATION
    }));
    setScopeVisible(true);
    
    // Start timer
    timerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.timeLeft <= 1) {
          clearInterval(timerRef.current);
          return { ...prev, timeLeft: 0, gameOver: true };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
  }, [gameState.difficulty, gameState.level, generateCharacters]);

  return (
    <div 
      className="relative w-full h-screen bg-gradient-to-br from-background to-secondary overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Scope Vignette Overlay */}
      {scopeVisible && (
        <>
          <div className="scope-vignette" />
          <div 
            className="scope-crosshair animate-scope-pulse"
            style={{ left: mousePosition.x, top: mousePosition.y }}
          >
            <div className="scope-center" />
          </div>
        </>
      )}

      {/* Game Area */}
      <div 
        ref={gameAreaRef}
        className="relative w-full h-full"
        style={{ cursor: scopeVisible ? 'none' : 'default' }}
      >
        {/* Characters */}
        {characters.map((character) => (
          <button
            key={character.id}
            className={`absolute text-4xl transition-all duration-200 hover:scale-110 ${
              character.isFound ? 'character-found' : 'character-bounce'
            } ${character.isFound ? 'opacity-50' : 'opacity-100'}`}
            style={{
              left: `${character.x}%`,
              top: `${character.y}%`,
              transform: 'translate(-50%, -50%)',
              filter: character.isFound && character.isGoofy 
                ? 'drop-shadow(0 0 20px hsl(var(--success-color)))' 
                : 'none'
            }}
            onClick={() => handleCharacterClick(character.id)}
            disabled={character.isFound}
          >
            {character.emoji}
          </button>
        ))}

        {/* HUD */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-50">
          {/* Left HUD Panel */}
          <Card className="hud-panel p-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <Target className="w-5 h-5 text-accent" />
                <span className="text-lg font-bold text-glow">SCOPE VIEW</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Score: <span className="text-accent font-bold animate-hud-glow">{gameState.score}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Level: <span className="text-primary font-bold">{gameState.level}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                High Score: <span className="text-accent">{highScore}</span>
              </div>
            </div>
          </Card>

          {/* Right HUD Panel */}
          <Card className="hud-panel p-4">
            <div className="space-y-2 text-right">
              <div className="text-lg font-bold text-glow">
                {gameState.gameStarted ? (
                  <span className={gameState.timeLeft <= 10 ? 'text-destructive animate-pulse' : 'text-accent'}>
                    {Math.floor(gameState.timeLeft / 60)}:{(gameState.timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                ) : (
                  'READY'
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Difficulty: <span className="text-primary capitalize">{gameState.difficulty}</span>
              </div>
              {gameState.gameStarted && (
                <div className="text-sm text-muted-foreground">
                  Targets: {characters.filter(c => c.isGoofy && !c.isFound).length} remaining
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Game Controls Overlay */}
        {(!gameState.gameStarted || gameState.gameOver) && (
          <div className="absolute inset-0 bg-background/90 flex items-center justify-center z-40">
            <Card className="hud-panel p-8 max-w-md w-full mx-4">
              <div className="text-center space-y-6">
                <h1 className="text-4xl font-bold text-glow">FIND GOOFY</h1>
                <p className="text-muted-foreground">
                  Use your scope to identify and eliminate all Goofy targets in the crowd!
                </p>
                
                {gameState.gameOver && gameState.timeLeft > 0 && (
                  <div className="space-y-2">
                    <p className="text-success-color font-bold">Level {gameState.level - 1} Complete!</p>
                    <p className="text-sm text-muted-foreground">Final Score: {gameState.score}</p>
                  </div>
                )}
                
                {gameState.gameOver && gameState.timeLeft === 0 && (
                  <div className="space-y-2">
                    <p className="text-destructive font-bold">Mission Failed!</p>
                    <p className="text-sm text-muted-foreground">Final Score: {gameState.score}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="block text-sm text-muted-foreground">
                    Difficulty:
                    <select 
                      value={gameState.difficulty}
                      onChange={(e) => setGameState(prev => ({ 
                        ...prev, 
                        difficulty: e.target.value as 'easy' | 'medium' | 'hard'
                      }))}
                      className="ml-2 bg-secondary text-foreground border border-border rounded px-2 py-1"
                      disabled={gameState.gameStarted}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </label>
                </div>

                <div className="flex space-x-3 justify-center">
                  {!gameState.gameStarted ? (
                    <Button onClick={startGame} className="btn-tactical flex items-center space-x-2">
                      <Play className="w-4 h-4" />
                      <span>Start Mission</span>
                    </Button>
                  ) : gameState.gameOver && gameState.timeLeft > 0 ? (
                    <>
                      <Button onClick={nextLevel} className="btn-tactical flex items-center space-x-2">
                        <Play className="w-4 h-4" />
                        <span>Next Level</span>
                      </Button>
                      <Button onClick={resetGame} variant="outline" className="flex items-center space-x-2">
                        <RotateCcw className="w-4 h-4" />
                        <span>Restart</span>
                      </Button>
                    </>
                  ) : (
                    <Button onClick={resetGame} className="btn-danger flex items-center space-x-2">
                      <RotateCcw className="w-4 h-4" />
                      <span>Try Again</span>
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}