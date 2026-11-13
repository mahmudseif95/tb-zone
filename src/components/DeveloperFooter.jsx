import React from 'react';

export default function DeveloperFooter() {
    const year = new Date().getFullYear();

    return (
        <footer
            style={{
                textAlign: 'center',
                padding: '14px 10px 22px',
                fontSize: '11px',
                color: 'var(--text-muted)',
                direction: 'ltr',
                userSelect: 'none'
            }}
        >
            By <strong style={{ color: 'var(--orange-primary)', fontWeight: '800' }}>Zolfa Tech Est</strong> • © {year}
        </footer>
    );
}