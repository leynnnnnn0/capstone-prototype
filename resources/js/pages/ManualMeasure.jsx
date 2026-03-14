import { useState } from 'react'
import { router } from '@inertiajs/react'

export default function ManualMeasure() {
    const [width,  setWidth]  = useState('')
    const [height, setHeight] = useState('')
    const [unit,   setUnit]   = useState('cm')
    const [errors, setErrors] = useState({})

    const validate = () => {
        const e = {}
        if (!width  || isNaN(width)  || +width  <= 0) e.width  = 'Enter a valid width'
        if (!height || isNaN(height) || +height <= 0) e.height = 'Enter a valid height'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const toCm = (val) => unit === 'in' ? (+val * 2.54).toFixed(1) : (+val).toFixed(1)

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!validate()) return
        router.visit('/products', {
            data: { w: toCm(width), h: toCm(height) },
        })
    }

    const field = (label, value, setter, key) => (
        <div style={s.field}>
            <label style={s.label}>{label}</label>
            <div style={s.inputRow}>
                <input
                    type="number"
                    value={value}
                    onChange={e => setter(e.target.value)}
                    placeholder="0"
                    style={{ ...s.input, ...(errors[key] ? s.inputError : {}) }}
                />
                <span style={s.unitTag}>{unit}</span>
            </div>
            {errors[key] && <span style={s.error}>{errors[key]}</span>}
        </div>
    )

    return (
        <div style={s.page}>
            <div style={s.card}>
                <div style={s.header}>
                    <div style={s.icon}>📐</div>
                    <h1 style={s.title}>Enter measurements</h1>
                    <p style={s.subtitle}>
                        Measure the width and height of your door or window opening
                        and enter them below.
                    </p>
                </div>

                <div style={s.unitSwitch}>
                    {['cm', 'in'].map(u => (
                        <button
                            key={u}
                            style={{ ...s.unitBtn, ...(unit === u ? s.unitBtnActive : {}) }}
                            onClick={() => setUnit(u)}
                        >
                            {u === 'cm' ? 'Centimeters' : 'Inches'}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} style={s.form}>
                    {field('Width', width,  setWidth,  'width')}
                    {field('Height', height, setHeight, 'height')}

                    <div style={s.preview}>
                        <div style={{
                            ...s.previewBox,
                            aspectRatio: width && height
                                ? `${+width} / ${+height}`
                                : '9 / 21',
                        }}>
                            <span style={s.previewLabel}>
                                {width && height
                                    ? `${width} × ${height} ${unit}`
                                    : 'Preview'}
                            </span>
                        </div>
                    </div>

                    <button type="submit" style={s.submit}>
                        Find matching products →
                    </button>
                </form>
            </div>
        </div>
    )
}

const s = {
    page: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#f8f7f4',
    },
    card: {
        background: '#fff',
        borderRadius: 20,
        padding: '32px 28px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
    },
    header: {
        textAlign: 'center',
        marginBottom: 24,
    },
    icon: { fontSize: 40, marginBottom: 12 },
    title: {
        fontSize: 22,
        fontWeight: 700,
        margin: '0 0 8px',
        color: '#111',
    },
    subtitle: {
        fontSize: 14,
        color: '#777',
        lineHeight: 1.5,
        margin: 0,
    },
    unitSwitch: {
        display: 'flex',
        background: '#f0efec',
        borderRadius: 10,
        padding: 4,
        marginBottom: 24,
    },
    unitBtn: {
        flex: 1,
        padding: '10px 0',
        border: 'none',
        borderRadius: 8,
        background: 'transparent',
        fontSize: 14,
        color: '#666',
        cursor: 'pointer',
        transition: 'all 0.15s',
    },
    unitBtnActive: {
        background: '#fff',
        color: '#111',
        fontWeight: 600,
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    label: {
        fontSize: 13,
        fontWeight: 600,
        color: '#333',
    },
    inputRow: {
        display: 'flex',
        alignItems: 'center',
        border: '1.5px solid #e0ddd6',
        borderRadius: 10,
        overflow: 'hidden',
    },
    input: {
        flex: 1,
        padding: '12px 14px',
        border: 'none',
        outline: 'none',
        fontSize: 16,
        color: '#111',
        background: 'transparent',
    },
    inputError: {
        background: '#fff5f5',
    },
    unitTag: {
        padding: '12px 14px',
        background: '#f5f4f0',
        color: '#888',
        fontSize: 13,
        fontWeight: 500,
        borderLeft: '1.5px solid #e0ddd6',
    },
    error: {
        fontSize: 12,
        color: '#e53e3e',
    },
    preview: {
        display: 'flex',
        justifyContent: 'center',
        padding: '8px 0',
    },
    previewBox: {
        maxWidth: 100,
        maxHeight: 160,
        width: '100%',
        background: '#f0efec',
        border: '2px dashed #d0cdc6',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewLabel: {
        fontSize: 11,
        color: '#999',
        textAlign: 'center',
        padding: 4,
    },
    submit: {
        padding: '15px 20px',
        background: '#111',
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        fontSize: 16,
        fontWeight: 600,
        cursor: 'pointer',
        marginTop: 8,
    },
}
