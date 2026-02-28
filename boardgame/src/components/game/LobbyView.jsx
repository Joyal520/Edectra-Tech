import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { AvatarChip } from '../ui/AvatarChip';
import { Users, Copy, Play, Settings } from 'lucide-react';

export function LobbyView() {
    const joinCode = "XJ-902";
    const teamA = [
        { name: "Alex", status: "ready" },
        { name: "Sam", status: "ready" },
        { name: "Jordan", status: "waiting" },
    ];
    const teamB = [
        { name: "Taylor", status: "ready" },
        { name: "Morgan", status: "waiting" },
    ];

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12">
            <div className="max-w-5xl mx-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-900 mb-2">Game Lobby</h1>
                        <p className="text-slate-500">Wait for your teammates to join the match.</p>
                    </div>
                    <Card padding="sm" className="flex items-center gap-4 bg-blue-50 border-blue-100 pr-2">
                        <div className="pl-2">
                            <span className="text-[10px] uppercase font-bold text-blue-400 block tracking-wider">Room Code</span>
                            <span className="text-2xl font-mono font-bold text-blue-600 tracking-widest">{joinCode}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-10 w-10 p-0 rounded-lg">
                            <Copy className="w-5 h-5 text-blue-500" />
                        </Button>
                    </Card>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Teams Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Teams (5/20)
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Team A */}
                            <Card className="space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-blue-600">Team Alpha</h3>
                                    <span className="text-xs font-medium text-slate-400">{teamA.length} Players</span>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {teamA.map((player, i) => (
                                        <AvatarChip key={i} name={player.name} status={player.status as any} />
                                    ))}
                                </div>
                            </Card>

                            {/* Team B */}
                            <Card className="space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-indigo-600">Team Beta</h3>
                                    <span className="text-xs font-medium text-slate-400">{teamB.length} Players</span>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {teamB.map((player, i) => (
                                        <AvatarChip key={i} name={player.name} status={player.status as any} />
                                    ))}
                                </div>
                            </Card>
                        </div>
                    </div>

                    {/* Settings Sidebar */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Match Settings
                        </h2>
                        <Card className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Quiz Category</label>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-medium text-slate-700">
                                    Global History & Culture
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Difficulty</label>
                                <div className="flex gap-2">
                                    {['Normal', 'Hard'].map(level => (
                                        <button key={level} className={cn(
                                            "flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all",
                                            level === 'Normal' ? "border-blue-500 bg-blue-50 text-blue-600" : "border-slate-100 text-slate-400"
                                        )}>
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <hr className="border-slate-100" />
                            <Button className="w-full gap-2" size="lg">
                                <Play className="w-5 h-5" />
                                Start Match
                            </Button>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
