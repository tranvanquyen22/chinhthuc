// Helper module for managing System Receiving Bank Account & VietQR Configuration for Top-Ups

import { supabase } from './supabase';

const SYSTEM_BANK_KEY = 'tq_system_bank_config';

const DEFAULT_SYSTEM_BANK = {
  bankName: 'MB Bank (Ngân Hàng Quân Đội)',
  bankCode: 'MB',
  accountNumber: '0988888888',
  accountHolder: 'CONG TY TNHH TQ STORE VIETNAM',
  branch: 'Sở Giao Dịch Hà Nội',
  transferSyntaxPrefix: 'NAP TQPAY',
  qrTemplateUrl: 'https://img.vietqr.io/image/MB-0988888888-compact2.png',
  updated_at: new Date().toISOString()
};

export const getSystemBankConfig = () => {
  try {
    const saved = localStorage.getItem(SYSTEM_BANK_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        bankName: parsed.bankName || DEFAULT_SYSTEM_BANK.bankName,
        bankCode: parsed.bankCode || DEFAULT_SYSTEM_BANK.bankCode,
        accountNumber: parsed.accountNumber || DEFAULT_SYSTEM_BANK.accountNumber,
        accountHolder: parsed.accountHolder || DEFAULT_SYSTEM_BANK.accountHolder,
        branch: parsed.branch || DEFAULT_SYSTEM_BANK.branch,
        transferSyntaxPrefix: parsed.transferSyntaxPrefix || DEFAULT_SYSTEM_BANK.transferSyntaxPrefix,
        qrTemplateUrl: parsed.qrTemplateUrl || `https://img.vietqr.io/image/${parsed.bankCode || 'MB'}-${parsed.accountNumber || '0988888888'}-compact2.png`,
        updated_at: parsed.updated_at || DEFAULT_SYSTEM_BANK.updated_at
      };
    }
  } catch (e) {
    console.error('getSystemBankConfig error:', e);
  }
  return DEFAULT_SYSTEM_BANK;
};

export const fetchCloudSystemBankConfig = async () => {
  try {
    const { data, error } = await supabase
      .from('tq_platform_config')
      .select('system_bank_config')
      .limit(1)
      .single();

    if (!error && data?.system_bank_config) {
      const parsed = data.system_bank_config;
      const configObj = {
        bankName: parsed.bankName || DEFAULT_SYSTEM_BANK.bankName,
        bankCode: parsed.bankCode || DEFAULT_SYSTEM_BANK.bankCode,
        accountNumber: parsed.accountNumber || DEFAULT_SYSTEM_BANK.accountNumber,
        accountHolder: parsed.accountHolder || DEFAULT_SYSTEM_BANK.accountHolder,
        branch: parsed.branch || DEFAULT_SYSTEM_BANK.branch,
        transferSyntaxPrefix: parsed.transferSyntaxPrefix || DEFAULT_SYSTEM_BANK.transferSyntaxPrefix,
        qrTemplateUrl: parsed.qrTemplateUrl || `https://img.vietqr.io/image/${parsed.bankCode || 'MB'}-${parsed.accountNumber || '0988888888'}-compact2.png`,
        updated_at: parsed.updated_at || new Date().toISOString()
      };
      localStorage.setItem(SYSTEM_BANK_KEY, JSON.stringify(configObj));
      return configObj;
    }
  } catch (err) {
    console.warn('Supabase Cloud System Bank Config Notice:', err?.message);
  }
  return getSystemBankConfig();
};

export const saveSystemBankConfig = async (bankObj) => {
  const bankCode = bankObj.bankCode || 'MB';
  const accountNumber = bankObj.accountNumber || '';
  const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png`;

  const payload = {
    bankName: bankObj.bankName || 'MB Bank',
    bankCode: bankCode,
    accountNumber: accountNumber,
    accountHolder: (bankObj.accountHolder || '').toUpperCase(),
    branch: bankObj.branch || '',
    transferSyntaxPrefix: (bankObj.transferSyntaxPrefix || 'NAP TQPAY').toUpperCase(),
    qrTemplateUrl: qrUrl,
    updated_at: new Date().toISOString()
  };

  localStorage.setItem(SYSTEM_BANK_KEY, JSON.stringify(payload));

  try {
    await supabase
      .from('tq_platform_config')
      .upsert({ id: 1, system_bank_config: payload, updated_at: new Date().toISOString() });
  } catch (err) {
    console.warn('Cloud System Bank Config save notice:', err?.message);
  }

  return payload;
};

// Generates dynamic VietQR image link with custom amount & transfer content
export const generateVietQRUrl = (bankCode, accountNumber, amount, addInfo) => {
  const cleanBank = bankCode || 'MB';
  const cleanAcc = accountNumber || '0988888888';
  const cleanAmount = amount ? Math.round(Number(amount)) : 0;
  const cleanInfo = encodeURIComponent(addInfo || 'NAP TQPAY');

  return `https://img.vietqr.io/image/${cleanBank}-${cleanAcc}-compact2.png?amount=${cleanAmount}&addInfo=${cleanInfo}`;
};
