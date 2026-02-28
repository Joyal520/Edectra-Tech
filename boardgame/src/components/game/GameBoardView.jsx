import React from 'react';
import { BoardTile, type TileType } from './BoardTile';
import { Card } from '../ui/Card';
import { Dice } from './Dice';
import { QuestionPanel } from './QuestionPanel';
import { AvatarChip } from '../ui/AvatarChip';
import { Trophy } from 'lucide-react';

export function GameBoardView() {
    const tiles: { type: TileType; label?: string }[] = [
        { type: 'normal', label: 'Start' },
        { type: 'speed' },
        { type: 'normal' },
        { type: 'challenge' },
        { type: 'normal' },
        { type: 'freeze' },
        { type: 'normal' },
        { type: 'mystery' },
        { type: 'normal' },
        { type: 'duel' },
        { type: 'normal' },
        { type: 'normal', label: 'Finish' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
            {/* Board Area */}
            <div className="flex-1 p-8 overflow-auto">
                <div className="grid grid-cols-4 gap-6 max-w-4xl mx-auto">
                    {tiles.map((tile, i) => (
                        <BoardTile
                            key={i}
                            type={tile.type}
                            label={tile.label}
                            active={i === 2}
                            players={i === 2 ? ['Player 1'] : []}
                        />
                    ))}
                </div>
            </div>

            {/* Side HUD */}
            <aside className="w-full lg:w-[400px] bg-white border-l border-slate-200 shadow-2xl z-20 flex flex-col">
                <div className="p-6 border-b border-slate-50">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-black text-xl text-slate-900 uppercase tracking-tight">Game HUD</h2>
                        <div className="flex items-center gap-1 text-green-600 font-bold text-sm bg-green-50 px-2 py-1 rounded-lg">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            LIVE
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Player</label>
                        <AvatarChip name="Alex" status="turn" size="lg" className="w-full" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Question Panel Mini/HUD version could go here, for now using the requested Question Panel */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Turn Interaction</label>
                        <Dice onRoll={(v) => console.log('Rolled', v)} />
                    </div>

                    <hr className="border-slate-50" />

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Leaderboard</label>
                            <Trophy className="w-3 h-3 text-yellow-500" />
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="font-bold text-slate-700">Team Alpha</span>
                                <span className="font-black text-blue-600">1,250</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 italic">
                                <span className="font-medium text-slate-400">Team Beta</span>
                                <span className="font-bold text-slate-400">800</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100">
                    <div className="text-center text-xs text-slate-400 font-medium">
                        Turn 4 of 20 • Standard Mode
                    </div>
                </div>
            </aside>
        </div>
    );
}
