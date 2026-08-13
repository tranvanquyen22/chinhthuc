// Helper utility to record System Action Logs (Audit Logs & Audit Trail)

export const recordAuditLog = (actor, role, action, details) => {
  try {
    const existingStr = localStorage.getItem('tq_audit_logs');
    const logs = existingStr ? JSON.parse(existingStr) : [];
    
    const newEntry = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actor: actor || 'Admin Hệ thống',
      role: role || 'SUPER_ADMIN',
      action: action || 'THAO TÁC HỆ THỐNG',
      details: details || '',
      ip: '127.0.0.1 (Supabase Cloud)',
      timestamp: new Date().toISOString()
    };

    logs.unshift(newEntry);
    // Persist up to 300 latest audit trail entries
    localStorage.setItem('tq_audit_logs', JSON.stringify(logs.slice(0, 300)));
    return newEntry;
  } catch (e) {
    console.error('Error writing audit log:', e);
  }
};

export const getAuditLogs = () => {
  try {
    const existingStr = localStorage.getItem('tq_audit_logs');
    return existingStr ? JSON.parse(existingStr) : [];
  } catch (e) {
    return [];
  }
};

export const clearAuditLogs = () => {
  localStorage.removeItem('tq_audit_logs');
};
