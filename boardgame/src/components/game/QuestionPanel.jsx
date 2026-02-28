import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { cn } from '../ui/Button';
import { Clock } from 'lucide-react';

interface QuestionPanelProps {
    question: string;
    options: string[];
    onSelect: (index: number) => void;
    selectedIndex?: number;
    timer?: number;
    type?: 'normal' | 'challenge';
}

export function QuestionPanel({
    question,
    options,
    onSelect,
    selectedIndex,
    timer,
    type = 'normal'
}: QuestionPanelProps) {
    const isChallenge = type === 'challenge';

    return (
        <Card
            variant="elevated"
            className={cn(
                "w-full max-w-2xl border-t-4",
                isChallenge ? "border-red-500" : "border-blue-500"
            )}
        >
            <div className="flex justify-between items-start mb-6">
                <div>
                    <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] border",
                        isChallenge ? "bg-red-50 text-red-600 border-red-100 uppercase" : "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                        {isChallenge ? '🔥 Hard Challenge' : 'Standard Question'}
                    </span>
                </div>
                {timer !== undefined && (
                    <div className="flex items-center gap-2 text-slate-500 font-mono font-bold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                        <Clock className="w-4 h-4" />
                        <span>{timer}s</span>
                    </div>
                )}
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-8 leading-tight">
                {question}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {options.map((option, index) => (
                    <button
                        key={index}
                        onClick={() => onSelect(index)}
                        className={cn(
                            "p-5 text-left rounded-2xl border-2 transition-all duration-200 group relative overflow-hidden",
                            selectedIndex === index
                                ? "border-blue-500 bg-blue-50 shadow-md transform -translate-y-1"
                                : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <span className={cn(
                                "w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm",
                                selectedIndex === index ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500"
                            )}>
                                {String.fromCharCode(65 + index)}
                            </span>
                            <span className={cn(
                                "font-medium",
                                selectedIndex === index ? "text-blue-900" : "text-slate-700"
                            )}>
                                {option}
                            </span>
                        </div>
                    </button>
                ))}
            </div>

            <div className="mt-8 flex justify-end">
                <Button
                    disabled={selectedIndex === undefined}
                    size="lg"
                    className="w-full md:w-auto min-w-[200px]"
                >
                    Commit Answer
                </Button>
            </div>
        </Card>
    );
}
