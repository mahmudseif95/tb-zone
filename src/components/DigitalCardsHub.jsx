import React, { useState } from 'react';
import {
    Tv,
    Gamepad2,
    Radio,
    Boxes,
    Search,
    CheckCircle2,
    X,
    Tag
} from 'lucide-react';

const ISTORE_CATALOG = {
    STREAM: {
        label: 'منصات المشاهدة',
        sub: 'STREAM',
        icon: Tv,
        brands: [
            {
                id: 'watch_it',
                name: 'Watch IT',
                items: [
                    { id: 'wit_1m', name: 'Watch IT حساب خاص (شهر)', wholesaleUSD: 3.48, defaultSellUSD: 5.0 },
                    { id: 'wit_3m', name: 'Watch IT حساب خاص (3 شهور)', wholesaleUSD: 9.5, defaultSellUSD: 13.0 },
                    { id: 'wit_1y', name: 'Watch IT حساب سنوي كامل', wholesaleUSD: 24.0, defaultSellUSD: 32.0 }
                ]
            },
            {
                id: 'disney',
                name: 'Disney+',
                items: [
                    { id: 'dis_1m', name: 'Disney+ حساب شهري', wholesaleUSD: 2.64, defaultSellUSD: 4.0 },
                    { id: 'dis_3m', name: 'Disney+ حساب (3 شهور)', wholesaleUSD: 7.2, defaultSellUSD: 10.5 },
                    { id: 'dis_1y', name: 'Disney+ حساب سنوي', wholesaleUSD: 22.0, defaultSellUSD: 30.0 }
                ]
            },
            {
                id: 'crunchyroll',
                name: 'Crunchyroll',
                items: [
                    { id: 'cr_1m', name: 'Crunchyroll Premium (شهر)', wholesaleUSD: 2.64, defaultSellUSD: 4.0 },
                    { id: 'cr_1y', name: 'Crunchyroll Mega Fan (سنة)', wholesaleUSD: 8.44, defaultSellUSD: 13.0 }
                ]
            },
            {
                id: 'yango',
                name: 'Yango Play',
                items: [
                    { id: 'yp_1m', name: 'Yango Play Private (شهر)', wholesaleUSD: 7.65, defaultSellUSD: 10.0 },
                    { id: 'yp_3m', name: 'Yango Play Private (3 شهور)', wholesaleUSD: 21.0, defaultSellUSD: 27.0 }
                ]
            },
            {
                id: 'hbo',
                name: 'HBO Max',
                items: [
                    { id: 'hbo_1m', name: 'HBO Max (شهر)', wholesaleUSD: 6.33, defaultSellUSD: 8.5 },
                    { id: 'hbo_3m', name: 'HBO Max (3 شهور)', wholesaleUSD: 17.5, defaultSellUSD: 23.0 }
                ]
            },
            {
                id: 'dramabox',
                name: 'Drama Box',
                items: [
                    { id: 'db_1m', name: 'Drama Box (شهر)', wholesaleUSD: 5.27, defaultSellUSD: 7.5 },
                    { id: 'db_3m', name: 'Drama Box (3 شهور)', wholesaleUSD: 14.5, defaultSellUSD: 19.0 }
                ]
            },
            {
                id: 'prime',
                name: 'Prime Video',
                items: [
                    { id: 'pv_1m', name: 'Prime Video Account (شهر)', wholesaleUSD: 4.48, defaultSellUSD: 6.5 },
                    { id: 'pv_6m', name: 'Prime Video Account (6 شهور)', wholesaleUSD: 18.0, defaultSellUSD: 25.0 }
                ]
            },
            {
                id: 'apple_stream',
                name: 'Apple Services',
                items: [
                    { id: 'app_tv_1m', name: 'Apple TV+ Account (شهر)', wholesaleUSD: 8.86, defaultSellUSD: 12.0 },
                    { id: 'app_mus_12m', name: 'Apple Music (سنة كاملة 12 شهر)', wholesaleUSD: 42.6, defaultSellUSD: 52.0 }
                ]
            },
            {
                id: 'osn_tod',
                name: 'OSN+ & TOD',
                items: [
                    { id: 'osn_1m', name: 'OSN Plus Full Account (شهر)', wholesaleUSD: 9.05, defaultSellUSD: 12.5 },
                    { id: 'tod_1m', name: 'TOD رياضة وترفيه (شهر)', wholesaleUSD: 8.5, defaultSellUSD: 12.0 },
                    { id: 'wetv_1m', name: 'WeTV VIP (شهر)', wholesaleUSD: 4.22, defaultSellUSD: 6.0 }
                ]
            },
            {
                id: 'netflix_shahid',
                name: 'Netflix & Shahid & Starz',
                items: [
                    { id: 'nf_sh', name: 'Netflix شاشة مشتركة (شهر)', wholesaleUSD: 2.2, defaultSellUSD: 3.5 },
                    { id: 'nf_full', name: 'Netflix حساب كامل 4K (شهر)', wholesaleUSD: 7.5, defaultSellUSD: 10.0 },
                    { id: 'sh_vip', name: 'Shahid VIP مسلسلات (شهر)', wholesaleUSD: 2.8, defaultSellUSD: 4.5 },
                    { id: 'sh_sport', name: 'Shahid VIP شامل الرياضة (شهر)', wholesaleUSD: 5.8, defaultSellUSD: 8.0 },
                    { id: 'angh_plus', name: 'أنغامي بلس Anghami Plus (شهر)', wholesaleUSD: 1.8, defaultSellUSD: 3.0 },
                    { id: 'starz_1m', name: 'Starzplay اشتراك شهري', wholesaleUSD: 2.5, defaultSellUSD: 4.0 }
                ]
            }
        ]
    },
    PROGRAMS: {
        label: 'البرامج والخدمات',
        sub: 'PROGRAM',
        icon: Boxes,
        brands: [
            {
                id: 'ai_tools',
                name: 'الذكاء الاصطناعي (AI)',
                items: [
                    { id: 'cld_1m', name: 'Claude Pro Shared (شهر)', wholesaleUSD: 6.39, defaultSellUSD: 9.0 },
                    { id: 'gpt_plus', name: 'ChatGPT Plus حساب شهري', wholesaleUSD: 18.5, defaultSellUSD: 24.0 },
                    { id: 'gemini_adv', name: 'Google Gemini Advanced (شهر)', wholesaleUSD: 7.5, defaultSellUSD: 11.0 },
                    { id: 'perp_pro', name: 'Perplexity AI Pro (شهر)', wholesaleUSD: 8.0, defaultSellUSD: 12.0 }
                ]
            },
            {
                id: 'design_media',
                name: 'التصميم والمونتاج',
                items: [
                    { id: 'canva_1y', name: 'Canva Pro اشتراك رسمي (سنة)', wholesaleUSD: 2.39, defaultSellUSD: 5.0 },
                    { id: 'capcut_pro', name: 'CapCut Pro مونتاج (شهر)', wholesaleUSD: 4.5, defaultSellUSD: 7.0 },
                    { id: 'adobe_all', name: 'Adobe Creative Cloud كامل 100GB (شهر)', wholesaleUSD: 32.2, defaultSellUSD: 39.0 },
                    { id: 'ad_pr', name: 'Adobe Premiere Pro CC (شهر)', wholesaleUSD: 21.26, defaultSellUSD: 26.0 },
                    { id: 'ad_ps', name: 'Adobe Photoshop CC (شهر)', wholesaleUSD: 21.26, defaultSellUSD: 26.0 },
                    { id: 'ad_ai', name: 'Adobe Illustrator CC (شهر)', wholesaleUSD: 21.26, defaultSellUSD: 26.0 },
                    { id: 'ad_ae', name: 'Adobe After Effects CC (شهر)', wholesaleUSD: 21.26, defaultSellUSD: 26.0 },
                    { id: 'ad_exp', name: 'Adobe Express Premium (6 شهور)', wholesaleUSD: 12.78, defaultSellUSD: 16.5 },
                    { id: 'autocad', name: 'Autodesk AutoCAD تفعيل أصلي', wholesaleUSD: 12.75, defaultSellUSD: 17.0 },
                    { id: 'picsart_1y', name: 'Picsart Gold (سنة كاملة)', wholesaleUSD: 6.5, defaultSellUSD: 10.0 }
                ]
            },
            {
                id: 'vpn_security',
                name: 'VPN والحماية والتحميل',
                items: [
                    { id: 'nord_3m', name: 'NordVPN Key (3 شهور)', wholesaleUSD: 4.78, defaultSellUSD: 7.0 },
                    { id: 'exp_1m', name: 'ExpressVPN Key (شهر)', wholesaleUSD: 3.72, defaultSellUSD: 5.5 },
                    { id: 'idm_key', name: 'Internet Download Manager مدى الحياة', wholesaleUSD: 15.3, defaultSellUSD: 19.0 },
                    { id: 'avast_1y', name: 'Avast Premium Security (سنة)', wholesaleUSD: 9.58, defaultSellUSD: 13.5 }
                ]
            },
            {
                id: 'os_office',
                name: 'مايكروسوفت وتعليم',
                items: [
                    { id: 'win11_pro', name: 'Windows 11 Pro Retail كود تفعيل دائم', wholesaleUSD: 11.71, defaultSellUSD: 16.0 },
                    { id: 'off_2024', name: 'Microsoft Office 2024 Pro Plus دائم', wholesaleUSD: 11.71, defaultSellUSD: 16.0 },
                    { id: 'duo_1y', name: 'Super Duolingo تعلّم لغات (سنة)', wholesaleUSD: 21.3, defaultSellUSD: 27.0 }
                ]
            }
        ]
    },
    GAMES: {
        label: 'قسم الألعاب',
        sub: 'GAMES',
        icon: Gamepad2,
        brands: [
            {
                id: 'pubg_games',
                name: 'PUBG Global',
                items: [
                    { id: 'pb_60', name: 'ببجي 60 UC شحن فوري', wholesaleUSD: 0.85, defaultSellUSD: 1.0 },
                    { id: 'pb_325', name: 'ببجي 325 UC', wholesaleUSD: 4.15, defaultSellUSD: 5.0 },
                    { id: 'pb_660', name: 'ببجي 660 UC رويال باس', wholesaleUSD: 8.25, defaultSellUSD: 10.0 },
                    { id: 'pb_1800', name: 'ببجي 1800 UC', wholesaleUSD: 20.5, defaultSellUSD: 24.5 },
                    { id: 'pb_3850', name: 'ببجي 3850 UC', wholesaleUSD: 41.0, defaultSellUSD: 48.0 },
                    { id: 'pb_8100', name: 'ببجي 8100 UC', wholesaleUSD: 82.0, defaultSellUSD: 95.0 }
                ]
            },
            {
                id: 'freefire_games',
                name: 'Free Fire',
                items: [
                    { id: 'ff_110', name: 'فري فاير 100+10 جواهر', wholesaleUSD: 0.85, defaultSellUSD: 1.25 },
                    { id: 'ff_231', name: 'فري فاير 210+21 جواهر', wholesaleUSD: 1.8, defaultSellUSD: 2.5 },
                    { id: 'ff_583', name: 'فري فاير 530+53 جواهر', wholesaleUSD: 4.3, defaultSellUSD: 5.5 },
                    { id: 'ff_1188', name: 'فري فاير 1080+108 جواهر', wholesaleUSD: 8.5, defaultSellUSD: 10.5 },
                    { id: 'ff_pass_w', name: 'عضوية فري فاير أسبوعية', wholesaleUSD: 1.8, defaultSellUSD: 2.5 },
                    { id: 'ff_pass_m', name: 'عضوية فري فاير شهرية', wholesaleUSD: 8.0, defaultSellUSD: 10.0 }
                ]
            },
            {
                id: 'jawaker_8ball',
                name: 'جواكر و 8 Ball Pool',
                items: [
                    { id: 'jw_10k', name: 'جواكر 10,000 توكنز', wholesaleUSD: 0.9, defaultSellUSD: 1.3 },
                    { id: 'jw_50k', name: 'جواكر 50,000 توكنز', wholesaleUSD: 4.4, defaultSellUSD: 5.5 },
                    { id: 'jw_100k', name: 'جواكر 100,000 توكنز', wholesaleUSD: 8.5, defaultSellUSD: 10.5 },
                    { id: 'pool_cash', name: '8 Ball Pool كاش وكوينز', wholesaleUSD: 3.5, defaultSellUSD: 5.0 }
                ]
            },
            {
                id: 'supercell_others',
                name: 'Clash & Brawl & Hay Day',
                items: [
                    { id: 'coc_pass', name: 'Clash of Clans Gold Pass', wholesaleUSD: 6.2, defaultSellUSD: 8.0 },
                    { id: 'cr_pass', name: 'Clash Royale Diamond Pass', wholesaleUSD: 10.5, defaultSellUSD: 13.0 },
                    { id: 'bs_gems', name: 'Brawl Stars 170 Gems', wholesaleUSD: 9.2, defaultSellUSD: 11.5 },
                    { id: 'hd_farm', name: 'Hay Day Farm Pass', wholesaleUSD: 4.5, defaultSellUSD: 6.0 },
                    { id: 'topwar_pack', name: 'Top War شحن عتاد', wholesaleUSD: 1.08, defaultSellUSD: 1.5 },
                    { id: 'lama_pack', name: 'Lama Games كوينز وباقات', wholesaleUSD: 2.0, defaultSellUSD: 3.0 }
                ]
            }
        ]
    },
    LIVE_CHAT: {
        label: 'برامج اللايف',
        sub: 'LIVE CHAT',
        icon: Radio,
        brands: [
            {
                id: 'toptop_sugo',
                name: 'TopTop & Sugo & Soul',
                items: [
                    { id: 'tt_c1', name: 'TopTop كوينز باقة 1', wholesaleUSD: 0.95, defaultSellUSD: 1.3 },
                    { id: 'tt_c2', name: 'TopTop كوينز باقة 2', wholesaleUSD: 4.7, defaultSellUSD: 6.0 },
                    { id: 'sg_c1', name: 'Sugo شحن كوينز وماسات', wholesaleUSD: 1.5, defaultSellUSD: 2.2 },
                    { id: 'sc_1', name: 'Soul Chill ماسات شحن', wholesaleUSD: 2.0, defaultSellUSD: 2.8 },
                    { id: 'ss_1', name: 'Soul Star شحن كوينز', wholesaleUSD: 2.5, defaultSellUSD: 3.5 }
                ]
            },
            {
                id: 'tango_soyo',
                name: 'Tango & SOYO & TAKA',
                items: [
                    { id: 'tg_c1', name: 'Tango تانجو كوينز باقة A', wholesaleUSD: 4.8, defaultSellUSD: 6.5 },
                    { id: 'tg_c2', name: 'Tango تانجو كوينز باقة B', wholesaleUSD: 9.5, defaultSellUSD: 12.5 },
                    { id: 'sy_1', name: 'SOYO كوينز روم', wholesaleUSD: 1.8, defaultSellUSD: 2.5 },
                    { id: 'tk_1', name: 'TAKA شحن كوينز', wholesaleUSD: 2.2, defaultSellUSD: 3.0 }
                ]
            },
            {
                id: 'waho_hiyaa',
                name: 'Waho & Hiyaa & Peta',
                items: [
                    { id: 'wh_1', name: 'Waho كوينز وذهب', wholesaleUSD: 1.2, defaultSellUSD: 1.8 },
                    { id: 'hy_1', name: 'Hiyaa روم لايف ماسات', wholesaleUSD: 2.0, defaultSellUSD: 2.9 },
                    { id: 'pt_1', name: 'Peta LIVE شحن رصيد', wholesaleUSD: 3.0, defaultSellUSD: 4.2 },
                    { id: 'hj_1', name: 'Honey Jar هوني جار كوينز', wholesaleUSD: 1.5, defaultSellUSD: 2.2 },
                    { id: 'oh_1', name: 'Oohla Chat شحن حساب', wholesaleUSD: 2.5, defaultSellUSD: 3.5 }
                ]
            },
            {
                id: 'yoho_poppo',
                name: 'YOHO & Poppo & Likee',
                items: [
                    { id: 'yh_waka', name: 'YOHO WAKA كوينز باقة شحن', wholesaleUSD: 4.8, defaultSellUSD: 6.5 },
                    { id: 'po_10k', name: 'Poppo Live 10,000 Coins', wholesaleUSD: 1.05, defaultSellUSD: 1.4 },
                    { id: 'po_50k', name: 'Poppo Live 50,000 Coins', wholesaleUSD: 5.2, defaultSellUSD: 6.8 },
                    { id: 'lk_diam', name: 'Likee لايكي ماسات', wholesaleUSD: 3.8, defaultSellUSD: 5.0 },
                    { id: 'tm_1', name: 'Tumile كوينز مكالمات', wholesaleUSD: 2.5, defaultSellUSD: 3.5 },
                    { id: 'lu_1', name: 'LiveU شحن جواهر', wholesaleUSD: 3.0, defaultSellUSD: 4.2 }
                ]
            },
            {
                id: 'meyo_mchat',
                name: 'Meyo & Migo & IMO & Yami',
                items: [
                    { id: 'my_1', name: 'Meyo Live ميو لايف ماسات', wholesaleUSD: 2.1, defaultSellUSD: 3.0 },
                    { id: 'mg_1', name: 'Migo Live ميجو شحن', wholesaleUSD: 2.4, defaultSellUSD: 3.3 },
                    { id: 'mc_1', name: 'Mchat شحن رصيد', wholesaleUSD: 1.8, defaultSellUSD: 2.6 },
                    { id: 'yh_lan', name: 'Yaahlan ياهلان كوينز', wholesaleUSD: 2.0, defaultSellUSD: 2.8 },
                    { id: 'imo_d', name: 'imo ماسات اتصال', wholesaleUSD: 1.9, defaultSellUSD: 2.7 },
                    { id: 'ym_star', name: 'Yami Star كوينز', wholesaleUSD: 1.5, defaultSellUSD: 2.2 },
                    { id: 'wk_star', name: 'Waki Star شحن', wholesaleUSD: 1.8, defaultSellUSD: 2.5 },
                    { id: 'hp_star', name: 'Hopi Star كوينز وباقات', wholesaleUSD: 2.0, defaultSellUSD: 2.8 },
                    { id: 'hl_star', name: 'Halo Star ماسات', wholesaleUSD: 2.2, defaultSellUSD: 3.0 }
                ]
            },
            {
                id: 'khalij_others',
                name: 'شات خليجي ومتنوع',
                items: [
                    { id: 'top_kh', name: 'Top Khalij توب خليج كوينز', wholesaleUSD: 3.5, defaultSellUSD: 5.0 },
                    { id: 'sl_ch', name: 'Salam Chat سلام شات رصيد', wholesaleUSD: 2.0, defaultSellUSD: 2.9 },
                    { id: 'hm_pt', name: 'Hami Party حامي بارتي ماسات', wholesaleUSD: 2.5, defaultSellUSD: 3.5 },
                    { id: 'fm_1', name: 'Fami فامي كوينز', wholesaleUSD: 1.8, defaultSellUSD: 2.5 },
                    { id: 'hp_lv', name: 'Hapi Live هابي لايف شحن', wholesaleUSD: 2.2, defaultSellUSD: 3.0 },
                    { id: 'gf_1', name: 'GoFun جو فن كوينز', wholesaleUSD: 1.9, defaultSellUSD: 2.7 },
                    { id: 'wc_1', name: 'Willchill ويل تشيل ماسات', wholesaleUSD: 2.3, defaultSellUSD: 3.2 },
                    { id: 'bl_1', name: 'Best Live بيست لايف كوينز', wholesaleUSD: 2.0, defaultSellUSD: 2.8 },
                    { id: 'fo_ch', name: 'FOFO Chat فوفو شات شحن', wholesaleUSD: 2.0, defaultSellUSD: 2.8 },
                    { id: 'kr_ch', name: 'Karak Chat كرك شات كوينز', wholesaleUSD: 1.8, defaultSellUSD: 2.5 },
                    { id: 'xn_lv', name: 'Xena Live زينا لايف ماسات', wholesaleUSD: 2.5, defaultSellUSD: 3.5 },
                    { id: 'fl_ch', name: '4FLIN Chat فور فلين رصيد', wholesaleUSD: 2.0, defaultSellUSD: 2.8 },
                    { id: 'zf_lv', name: 'Zaffallive زفة لايف كوينز', wholesaleUSD: 2.2, defaultSellUSD: 3.0 },
                    { id: 'hl_mi', name: 'Hilami هيلامي شحن', wholesaleUSD: 1.9, defaultSellUSD: 2.7 },
                    { id: 'nu_ch', name: 'Niu Chat نيو شات رصيد', wholesaleUSD: 1.8, defaultSellUSD: 2.5 },
                    { id: 'ol_ch', name: 'Oloo أولو كوينز', wholesaleUSD: 2.0, defaultSellUSD: 2.8 },
                    { id: 'bl_la', name: 'Bulala بولالا ماسات', wholesaleUSD: 2.1, defaultSellUSD: 2.9 },
                    { id: 'nt_ch', name: 'Nita نيتا شات شحن', wholesaleUSD: 1.7, defaultSellUSD: 2.4 }
                ]
            }
        ]
    }
};

export default function DigitalCardsHub({
    sources = [],
    customers = [],
    exchangeRate = 89500,
    onExecuteSale
}) {
    const [activeTab, setActiveTab] = useState('STREAM');
    const [selectedBrandId, setSelectedBrandId] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);

    // استمارة المبيع
    const [customCostUSD, setCustomCostUSD] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');
    const [sellingCurrency, setSellingCurrency] = useState('USD');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [targetWalletId, setTargetWalletId] = useState(sources[0]?.id || '');
    const [paymentType, setPaymentType] = useState('cash');
    const [customerSuggestions, setCustomerSuggestions] = useState([]);

    const currentCategory = ISTORE_CATALOG[activeTab] || ISTORE_CATALOG.STREAM;
    const brandsList = currentCategory.brands || [];

    // تصفية المنتجات
    let displayedItems = [];
    if (selectedBrandId === 'all') {
        brandsList.forEach(b => {
            displayedItems.push(...b.items.map(it => ({ ...it, brandName: b.name })));
        });
    } else {
        const targetB = brandsList.find(b => b.id === selectedBrandId);
        if (targetB) {
            displayedItems = targetB.items.map(it => ({ ...it, brandName: targetB.name }));
        }
    }

    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        displayedItems = displayedItems.filter(it =>
            it.name.toLowerCase().includes(q) || it.brandName.toLowerCase().includes(q)
        );
    }

    const handleOpenSale = (item) => {
        setSelectedItem(item);
        setCustomCostUSD(item.wholesaleUSD.toString());
        setSellingPrice(item.defaultSellUSD.toString());
        setSellingCurrency('USD');
        setCustomerName('');
        setCustomerPhone('');
        setTargetWalletId(sources[0]?.id || '');
        setPaymentType('cash');
        setCustomerSuggestions([]);
    };

    const handleCustomerSearch = (query) => {
        setCustomerName(query);
        if (!query.trim()) {
            setCustomerSuggestions([]);
            return;
        }
        const clean = query.toLowerCase().trim();
        const matches = customers.filter(c =>
            c.name?.toLowerCase().includes(clean) || (c.phone && c.phone.includes(clean))
        );
        setCustomerSuggestions(matches);
    };

    const handleSelectCustomer = (c) => {
        setCustomerName(c.name);
        setCustomerPhone(c.phone || '');
        setCustomerSuggestions([]);
    };

    const handleSubmitSale = (e) => {
        e.preventDefault();
        if (!selectedItem) return;

        const costValUSD = parseFloat(customCostUSD) || 0;
        const sellPriceVal = parseFloat(sellingPrice) || 0;
        const sellInUSD = sellingCurrency === 'LBP' ? (sellPriceVal / exchangeRate) : sellPriceVal;
        const profitUSD = Math.max(0, sellInUSD - costValUSD);

        if (onExecuteSale) {
            onExecuteSale({
                title: selectedItem.name,
                itemName: `${selectedItem.name} (${selectedItem.brandName || ''})`,
                sellingPrice: sellPriceVal,
                currency: sellingCurrency,
                costUSD: costValUSD,
                profitUSD: parseFloat(profitUSD.toFixed(2)),
                walletId: targetWalletId,
                customerName: customerName.trim() || 'عام',
                customerPhone: customerPhone.trim(),
                paymentType,
                isDebt: paymentType === 'debt',
                date: new Date().toISOString()
            });
        }

        setSelectedItem(null);
    };

    const calcCurrentProfit = () => {
        const cost = parseFloat(customCostUSD) || 0;
        const sell = parseFloat(sellingPrice) || 0;
        const sellUSD = sellingCurrency === 'LBP' ? (sell / exchangeRate) : sell;
        return (sellUSD - cost).toFixed(2);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', direction: 'rtl' }}>

            {/* 1. التبويبات الأربعة الرئيسية كما في المتجر */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {Object.keys(ISTORE_CATALOG).map(key => {
                    const cat = ISTORE_CATALOG[key];
                    const Icon = cat.icon;
                    const isSelected = activeTab === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => {
                                setActiveTab(key);
                                setSelectedBrandId('all');
                                setSearchQuery('');
                            }}
                            style={{
                                background: isSelected ? 'var(--orange-primary)' : 'var(--bg-card)',
                                color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                                border: isSelected ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                borderRadius: '14px',
                                padding: '10px 4px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            <Icon size={18} />
                            <span style={{ fontSize: '11px', fontWeight: '900' }}>{cat.label}</span>
                            <span style={{ fontSize: '8px', opacity: 0.8, textTransform: 'uppercase' }}>{cat.sub}</span>
                        </button>
                    );
                })}
            </div>

            {/* 2. شريط البحث والفلترة حسب المنصة */}
            <div className="tz-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
                <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="ابحث بالاسم أو المنصة (مثال: Claude, Netflix, ببجي, تانجو)..."
                        className="tz-input"
                        style={{ paddingRight: '36px', height: '38px', fontSize: '12px' }}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* أزرار الفئات الفرعية للمنصة */}
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                    <button
                        type="button"
                        onClick={() => setSelectedBrandId('all')}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '10px',
                            border: selectedBrandId === 'all' ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                            background: selectedBrandId === 'all' ? 'var(--orange-subtle)' : 'var(--bg-card-sub)',
                            color: selectedBrandId === 'all' ? 'var(--orange-primary)' : 'var(--text-main)',
                            fontSize: '11px',
                            fontWeight: '900',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        الكل ({brandsList.reduce((sum, b) => sum + b.items.length, 0)})
                    </button>

                    {brandsList.map(brand => (
                        <button
                            key={brand.id}
                            type="button"
                            onClick={() => setSelectedBrandId(brand.id)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '10px',
                                border: selectedBrandId === brand.id ? '1.5px solid var(--orange-primary)' : '1px solid var(--border-color)',
                                background: selectedBrandId === brand.id ? 'var(--orange-subtle)' : 'var(--bg-card-sub)',
                                color: selectedBrandId === brand.id ? 'var(--orange-primary)' : 'var(--text-main)',
                                fontSize: '11px',
                                fontWeight: '900',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {brand.name} ({brand.items.length})
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. شبكة عرض المنتجات الكاملة */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                {displayedItems.length === 0 ? (
                    <div className="tz-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
                        لا توجد بطاقات أو باقات مطابقة للبحث.
                    </div>
                ) : (
                    displayedItems.map(prod => (
                        <div
                            key={prod.id}
                            className="tz-card"
                            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '12px', gap: '10px' }}
                        >
                            <div>
                                <span style={{ fontSize: '9px', color: 'var(--orange-primary)', fontWeight: 'bold' }}>
                                    {prod.brandName}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text-main)', display: 'block', lineHeight: '1.4', marginTop: '2px' }}>
                                    {prod.name}
                                </span>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', background: 'var(--bg-card-sub)', padding: '6px 8px', borderRadius: '8px', fontSize: '11px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>جملة: <b style={{ color: 'var(--red)' }}>${prod.wholesaleUSD}</b></span>
                                    <span style={{ color: 'var(--text-main)' }}>مبيع: <b style={{ color: 'var(--green)' }}>${prod.defaultSellUSD}</b></span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleOpenSale(prod)}
                                className="btn-primary"
                                style={{ height: '36px', fontSize: '12px', borderRadius: '10px' }}
                            >
                                <Tag size={13} />
                                <span>تسجيل بيع للزبون</span>
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* 4. نافذة تسجيل المبيع السريع - محمي بحصر الإغلاق بزر X فقط */}
            {selectedItem && (
                <div className="modal-overlay">
                    <div className="modal-center" style={{ maxWidth: '420px', maxHeight: '88vh', overflowY: 'auto' }}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--orange-primary)' }}>
                                    بيع: {selectedItem.name}
                                </h3>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {selectedItem.brandName} • حساب التكلفة والربح المباشر
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedItem(null)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitSale} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '8px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>تكلفة الجملة ($):</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="tz-input"
                                        value={customCostUSD}
                                        onChange={e => setCustomCostUSD(e.target.value)}
                                        style={{ fontWeight: 'bold', color: 'var(--red)' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>سعر المبيع للزبون:</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '4px' }}>
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            className="tz-input"
                                            value={sellingPrice}
                                            onChange={e => setSellingPrice(e.target.value)}
                                            style={{ fontWeight: 'bold', color: 'var(--orange-primary)' }}
                                        />
                                        <select
                                            className="tz-select"
                                            value={sellingCurrency}
                                            onChange={e => {
                                                const cur = e.target.value;
                                                setSellingCurrency(cur);
                                                if (cur === 'LBP' && sellingCurrency === 'USD') {
                                                    setSellingPrice(Math.round((parseFloat(sellingPrice) || 0) * exchangeRate).toString());
                                                } else if (cur === 'USD' && sellingCurrency === 'LBP') {
                                                    setSellingPrice(((parseFloat(sellingPrice) || 0) / exchangeRate).toFixed(2));
                                                }
                                            }}
                                        >
                                            <option value="USD">$</option>
                                            <option value="LBP">LBP</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* احتساب الربح الفوري */}
                            <div style={{ background: 'var(--bg-card-sub)', padding: '8px 12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                                <span>صافي ربحك في هذه العملية:</span>
                                <b style={{ color: parseFloat(calcCurrentProfit()) >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '14px' }}>
                                    {parseFloat(calcCurrentProfit()) >= 0 ? `+ $${calcCurrentProfit()}` : `- $${Math.abs(calcCurrentProfit())}`}
                                </b>
                            </div>

                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>خصم تكلفة الجملة من محفظة:</label>
                                <select
                                    className="tz-select"
                                    value={targetWalletId}
                                    onChange={e => setTargetWalletId(e.target.value)}
                                >
                                    {sources.map(w => (
                                        <option key={w.id} value={w.id}>
                                            {w.name} (متوفر: ${parseFloat(w.balanceUSD ?? w.balance ?? 0).toFixed(2)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ position: 'relative' }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>اسم الزبون (اختياري):</label>
                                <input
                                    type="text"
                                    placeholder="ابحث بالاسم أو اكتب اسم جديد..."
                                    className="tz-input"
                                    value={customerName}
                                    onChange={e => handleCustomerSearch(e.target.value)}
                                    autoComplete="off"
                                />

                                {customerSuggestions.length > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        background: 'var(--bg-card)',
                                        border: '1.5px solid var(--orange-primary)',
                                        borderRadius: '12px',
                                        zIndex: 110,
                                        maxHeight: '120px',
                                        overflowY: 'auto',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                        marginTop: '2px'
                                    }}>
                                        {customerSuggestions.map(cust => (
                                            <div
                                                key={cust.id}
                                                onClick={() => handleSelectCustomer(cust)}
                                                style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}
                                            >
                                                <span style={{ fontWeight: 'bold' }}>{cust.name}</span>
                                                <span style={{ color: 'var(--text-muted)' }}>{cust.phone}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setPaymentType('cash')}
                                    style={{
                                        padding: '8px',
                                        borderRadius: '10px',
                                        border: paymentType === 'cash' ? '1.5px solid var(--green)' : '1px solid var(--border-color)',
                                        background: paymentType === 'cash' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card-sub)',
                                        color: paymentType === 'cash' ? 'var(--green)' : 'var(--text-main)',
                                        fontWeight: 'bold',
                                        fontSize: '11px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    كاش مقبوض
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentType('debt')}
                                    style={{
                                        padding: '8px',
                                        borderRadius: '10px',
                                        border: paymentType === 'debt' ? '1.5px solid var(--red)' : '1px solid var(--border-color)',
                                        background: paymentType === 'debt' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-card-sub)',
                                        color: paymentType === 'debt' ? 'var(--red)' : 'var(--text-main)',
                                        fontWeight: 'bold',
                                        fontSize: '11px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    تسجيل كدين على الزبون
                                </button>
                            </div>

                            <button type="submit" className="btn-primary" style={{ height: '44px', marginTop: '6px' }}>
                                <CheckCircle2 size={16} />
                                <span>تثبيت العملية وخصم الصندوق فوراً</span>
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}