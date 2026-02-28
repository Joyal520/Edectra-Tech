/**
 * EDTECHRA — KNOWLEDGE QUEST ARENA (Version 2)
 * MODULAR SOUND SYSTEM (WEB AUDIO API)
 */

class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
    }

    beep(freq, duration, type = 'sine', volume = 0.1) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    /* Frequency sweep — great for whoosh/rising/falling effects */
    sweep(startFreq, endFreq, duration, type = 'sine', volume = 0.1) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    /* White noise burst — for impact/mystery effects */
    noise(duration, volume = 0.06) {
        if (!this.enabled) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        src.connect(gain);
        gain.connect(this.ctx.destination);
        src.start();
    }

    play(effect) {
        // Resume context on first interaction
        if (this.ctx.state === 'suspended') this.ctx.resume();

        switch (effect) {
            case 'roll':
                this.beep(300, 0.1, 'square', 0.05);
                setTimeout(() => this.beep(400, 0.1, 'square', 0.05), 50);
                break;
            case 'correct':
                this.beep(523.25, 0.2); // C5
                setTimeout(() => this.beep(659.25, 0.4), 100); // E5
                break;
            case 'wrong':
                this.beep(220, 0.3, 'sawtooth');
                setTimeout(() => this.beep(165, 0.5, 'sawtooth'), 150);
                break;
            case 'move':
                this.beep(800, 0.05, 'triangle', 0.05);
                break;
            case 'win':
                this.victoryFanfare();
                break;

            /* ── TILE-SPECIFIC SOUNDS ── */

            case 'speed':
                // Fast rising whoosh
                this.sweep(300, 1200, 0.4, 'sawtooth', 0.08);
                setTimeout(() => this.beep(1400, 0.15, 'sine', 0.06), 200);
                break;

            case 'freeze':
                // Icy shimmer — high soft tones
                this.beep(1200, 0.6, 'sine', 0.04);
                setTimeout(() => this.beep(1600, 0.5, 'sine', 0.03), 100);
                setTimeout(() => this.beep(2000, 0.4, 'sine', 0.02), 200);
                setTimeout(() => this.sweep(1800, 800, 0.8, 'sine', 0.03), 300);
                break;

            case 'challenge':
                // Dramatic suspense chord
                this.beep(220, 0.6, 'sawtooth', 0.06);
                this.beep(277.18, 0.6, 'sawtooth', 0.05);
                this.beep(329.63, 0.6, 'sawtooth', 0.05);
                setTimeout(() => {
                    this.beep(261.63, 0.5, 'square', 0.04);
                    this.beep(329.63, 0.5, 'square', 0.04);
                }, 400);
                break;

            case 'twist':
                // Short dramatic impact rumble
                this.noise(0.3, 0.1);
                this.beep(80, 0.3, 'square', 0.12);
                setTimeout(() => this.sweep(200, 600, 0.25, 'sawtooth', 0.06), 150);
                setTimeout(() => this.beep(500, 0.15, 'triangle', 0.06), 300);
                break;

            case 'mystery':
                // Magical sparkle arpeggio
                const sparkleNotes = [784, 988, 1175, 1319, 1568];
                sparkleNotes.forEach((f, i) => {
                    setTimeout(() => this.beep(f, 0.3, 'sine', 0.06), i * 80);
                });
                setTimeout(() => this.beep(1568, 0.6, 'sine', 0.04), 450);
                break;

            case 'power':
                // Card flip snap + reward
                this.noise(0.05, 0.12);
                this.beep(600, 0.08, 'square', 0.08);
                setTimeout(() => {
                    this.beep(880, 0.2, 'sine', 0.07);
                    this.beep(1108, 0.2, 'sine', 0.06);
                }, 100);
                setTimeout(() => this.beep(1318, 0.35, 'sine', 0.05), 250);
                break;

            case 'duel':
                // Battle horn — brass-like
                this.beep(220, 0.3, 'sawtooth', 0.1);
                this.beep(330, 0.3, 'sawtooth', 0.08);
                setTimeout(() => {
                    this.beep(440, 0.4, 'sawtooth', 0.1);
                    this.beep(554, 0.4, 'sawtooth', 0.07);
                }, 200);
                setTimeout(() => this.beep(660, 0.5, 'sawtooth', 0.08), 400);
                break;
        }
    }

    victoryFanfare() {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((f, i) => {
            setTimeout(() => this.beep(f, 0.5), i * 150);
        });
    }
}

window.sounds = new SoundManager();
