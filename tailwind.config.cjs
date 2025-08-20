module.exports = {
    darkMode: 'class',
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}'
    ],
    theme: {
        extend: {
            colors: {
                primary: '#ff6bcb',
                secondary: '#6b9bff',
                accent: '#ffe66b'
            },
            fontFamily: {
                kawaii: ['"Comic Neue"', 'ui-sans-serif', 'system-ui']
            },
            backgroundImage: {
                'anime-cloud': 'linear-gradient(135deg,#fdfbfb 0%,#ebedee 100%)',
                'anime-pink': 'linear-gradient(135deg,#fbc2eb 0%,#a6c1ee 100%)',
                'anime-dark': 'linear-gradient(135deg,#1f1d2b 0%,#2e3350 100%)',
                'anime-dark-galaxy': 'radial-gradient(circle at 20% 30%,rgba(255,107,203,0.18),rgba(255,107,203,0) 60%), radial-gradient(circle at 80% 70%,rgba(107,155,255,0.18),rgba(107,155,255,0) 55%), linear-gradient(135deg,#181a27 0%,#262b45 100%)',
                'black-oled': 'linear-gradient(#000,#050505)'
            },
            keyframes: {
                floaty: {
                    '0%,100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-6px)' }
                },
                pulseBorder: {
                    '0%': { boxShadow: '0 0 0 0 rgba(255,107,203,0.5)' },
                    '70%': { boxShadow: '0 0 0 12px rgba(255,107,203,0)' },
                    '100%': { boxShadow: '0 0 0 0 rgba(255,107,203,0)' }
                },
                flipIn: {
                    '0%': { transform: 'rotateX(90deg)', opacity: 0 },
                    '100%': { transform: 'rotateX(0deg)', opacity: 1 }
                },
                pop: {
                    '0%': { transform: 'scale(.6)', opacity: 0 },
                    '70%': { transform: 'scale(1.05)', opacity: 1 },
                    '100%': { transform: 'scale(1)' }
                }
            },
            animation: {
                floaty: 'floaty 4s ease-in-out infinite',
                pulseBorder: 'pulseBorder 2s infinite',
                flipIn: 'flipIn .5s ease',
                pop: 'pop .35s cubic-bezier(.68,-0.55,.27,1.55)'
            }
        }
    },
    plugins: []
};
