import React, { useState } from 'react';
import { QuestionPanel } from './QuestionPanel';
import { cn } from '../ui/Button';

export function QuestionFocusView() {
    const [selected, setSelected] = useState < number > ();

    return (
        <div className="min-h-screen bg-slate-100/50 backdrop-blur-sm flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/5 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

            <div className="w-full max-w-4xl z-10 animate-in fade-in zoom-in duration-500">
                <QuestionPanel
                    type="challenge"
                    timer={25}
                    question="Which architectural style is characterized by pointed arches, ribbed vaults, and flying buttresses?"
                    options={[
                        "Romanesque",
                        "Gothic",
                        "Renaissance",
                        "Neoclassical"
                    ]}
                    selectedIndex={selected}
                    onSelect={setSelected}
                />

                <p className="mt-8 text-center text-slate-400 text-sm font-medium">
                    Answer correctly to move <span className="text-blue-500 font-bold">3 tiles</span> forward!
                </p>
            </div>
        </div>
    );
}
