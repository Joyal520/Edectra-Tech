import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Play, Pause, Square, Upload, BarChart3, Volume2, Sparkles, Sliders } from 'lucide-react';

export function HostDashboardView() {
    const stats = [
        { label: 'Active Teams', value: '12' },
        { label: 'Avg. Progress', value: '45%' },
        { label: 'Time Elapsed', value: '12:40' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Top Header / Control Bar */}
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white font-black text-xl">E</div>
                    <div>
                        <h1 className="font-bold text-slate-900 leading-none">Teacher Control Center</h1>
                        <span className="text-xs text-slate-400">Match ID: #88219</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="success" size="sm" className="gap-2">
                        <Play className="w-4 h-4" /> Start
                    </Button>
                    <Button variant="ghost" size="sm" className="bg-slate-100 gap-2">
                        <Pause className="w-4 h-4" /> Pause
                    </Button>
                    <Button variant="danger" size="sm" className="gap-2">
                        <Square className="w-4 h-4 fill-current" /> End
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Quick Stats & Leaderboard */}
                <div className="lg:col-span-8 space-y-8">
                    <div className="grid grid-cols-3 gap-6">
                        {stats.map((stat, i) => (
                            <Card key={i} padding="sm" className="text-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{stat.label}</span>
                                <span className="text-2xl font-black text-slate-900">{stat.value}</span>
                            </Card>
                        ))}
                    </div>

                    <Card>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-blue-500" />
                                Live Team Leaderboard
                            </h2>
                        </div>
                        <div className="space-y-6">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between text-sm font-bold">
                                        <span className="text-slate-700">Team {['Alpha', 'Beta', 'Gamma', 'Delta'][i - 1]}</span>
                                        <span className="text-blue-600">{2000 - (i * 300)} pts</span>
                                    </div>
                                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${80 - (i * 15)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Right Column: Settings & Import */}
                <div className="lg:col-span-4 space-y-8">
                    <Card className="border-dashed border-2 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition-all cursor-pointer group">
                        <div className="py-8 flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Upload className="w-6 h-6 text-blue-500" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-1">Import Quiz</h3>
                            <p className="text-xs text-slate-400 px-8">Drag & drop your .EQM file here to update the game pool.</p>
                        </div>
                    </Card>

                    <Card className="space-y-6">
                        <h2 className="font-bold text-lg flex items-center gap-2 mb-2">
                            <Sliders className="w-5 h-5 text-indigo-500" />
                            Game Effects
                        </h2>

                        <div className="space-y-4">
                            {[
                                { icon: Volume2, label: 'Sound Effects', active: true },
                                { icon: Sparkles, label: 'Confetti Effects', active: true },
                                { icon: Sliders, label: 'Camera Shake', active: false },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <item.icon className={cn("w-4 h-4", item.active ? "text-indigo-500" : "text-slate-400")} />
                                        <span className={cn("text-sm font-medium", item.active ? "text-slate-800" : "text-slate-400")}>{item.label}</span>
                                    </div>
                                    <div className={cn(
                                        "w-10 h-5 rounded-full relative transition-colors cursor-pointer",
                                        item.active ? "bg-indigo-500" : "bg-slate-200"
                                    )}>
                                        <div className={cn(
                                            "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm",
                                            item.active ? "right-0.5" : "left-0.5"
                                        )} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}
