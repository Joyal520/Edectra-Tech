import React, { useState } from 'react';
import { cn } from '../ui/Button';

interface DiceProps {
    onRoll?: (value: number) => void;
    disabled?: boolean;
}

export function Dice({ onRoll, disabled }: DiceProps) {
    const [value, setValue] = useState(1);
    const [rolling, setRolling] = useState(false);

    const roll = () => {
        if (disabled || rolling) return;
        setRolling(true);

        // Animation cycles
        let count = 0;
        const interval = setInterval(() => {
            setValue(Math.floor(Math.random() * 6) + 1);
            count++;
            if (count > 10) {
                clearInterval(interval);
                const finalValue = Math.floor(Math.random() * 6) + 1;
                setValue(finalValue);
                setRolling(false);
                onRoll?.(finalValue);
            }
        }, 100);
    };

    const dots = {
        1: [[50, 50]],
        2: [[25, 25], [75, 75]],
        3: [[25, 25], [50, 50], [75, 75]],
        4: [[25, 25], [25, 75], [75, 25], [75, 75]],
        5: [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
        6: [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]],
    }[value] || [];

    return (
        <div className="flex flex-col items-center gap-4">
            <div
                onClick={roll}
                className={cn(
                    "w-20 h-20 bg-white rounded-2xl relative cursor-pointer shadow-xl border-t-2 border-slate-50",
                    rolling && "animate-bounce scale-110",
                    disabled && "opacity-50 cursor-not-allowed grayscale"
                )}
            >
                <div className="absolute inset-2 bg-slate-50 rounded-lg shadow-inner flex items-center justify-center">
                    <div className="w-full h-full relative">
                        {dots.map(([x, y], i) => (
                            <div
                                key={i}
                                className="absolute w-3 h-3 bg-blue-600 rounded-full shadow-sm"
                                style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <button
                disabled={disabled || rolling}
                onClick={roll}
                className="px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-bold hover:bg-blue-200 transition-colors"
            >
                {rolling ? 'Rolling...' : 'Roll Dice'}
            </button>
        </div>
    );
}
