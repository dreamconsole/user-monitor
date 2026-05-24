import { create } from 'zustand';

const ORG_ID_KEY = 'sa_selected_org_id';
const ORG_NAME_KEY = 'sa_selected_org_name';

const readStored = () => ({
    selectedOrgId: localStorage.getItem(ORG_ID_KEY) || null,
    selectedOrgName: localStorage.getItem(ORG_NAME_KEY) || null,
});

const useSuperAdminStore = create((set) => ({
    ...readStored(),

    setSelectedOrg: (id, name = null) => {
        if (id) {
            localStorage.setItem(ORG_ID_KEY, id);
            if (name) localStorage.setItem(ORG_NAME_KEY, name);
        } else {
            localStorage.removeItem(ORG_ID_KEY);
            localStorage.removeItem(ORG_NAME_KEY);
        }
        set({
            selectedOrgId: id || null,
            selectedOrgName: name || (id ? localStorage.getItem(ORG_NAME_KEY) : null),
        });
    },

    clearSelectedOrg: () => {
        localStorage.removeItem(ORG_ID_KEY);
        localStorage.removeItem(ORG_NAME_KEY);
        set({ selectedOrgId: null, selectedOrgName: null });
    },
}));

export default useSuperAdminStore;
