/**
 * EDTECHRA — KNOWLEDGE QUEST ARENA (Version 2)
 * CINEMATIC CAMERA SYSTEM
 */

class CinematicCamera {
    constructor() {
        this.board = document.getElementById('camera-world');
        this.viewport = document.getElementById('board-viewport');
        this.isMoving = false;

        // Initial Intro Fly-In
        this.triggerIntro();
    }

    triggerIntro() {
        this.viewport.style.transition = 'transform 2s cubic-bezier(0.34, 1.56, 0.64, 1)';
        this.viewport.style.transform = 'scale(0.1) rotateX(10deg)';

        setTimeout(() => {
            if (window.game) window.game.adjustScreenFit();
        }, 100);
    }

    focus(player) {
        if (!player || !player.tokenEl) return;

        const rect = player.tokenEl.getBoundingClientRect();
        const worldRect = this.board.getBoundingClientRect();

        const centerX = worldRect.width / 2;
        const centerY = worldRect.height / 2;

        const offsetX = centerX - (rect.left + rect.width / 2);
        const offsetY = centerY - (rect.top + rect.height / 2);

        this.applyTransform(1.15, offsetX * 0.2, offsetY * 0.2, 0);
    }

    snapToAll() {
        this.applyTransform(1, 0, 0, 0);
    }

    applyTransform(scale, x, y, rotate) {
        this.viewport.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
        this.viewport.style.transform = `scale(${scale}) translate(${x}px, ${y}px) rotate(${rotate}deg)`;
    }

    shake() {
        this.viewport.classList.add('camera-shake');
        setTimeout(() => this.viewport.classList.remove('camera-shake'), 500);
    }
}

window.camera = new CinematicCamera();
