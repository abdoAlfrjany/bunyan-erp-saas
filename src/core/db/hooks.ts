// src/core/db/hooks.ts
// Stable selectors for useDataStore — prevents "Maximum update depth exceeded"
// القاعدة: كل selector يُرجع قيمة واحدة أو مصفوفة مستقرة — ممنوع useDataStore() بلا selector

import { useDataStore } from './store';


// ══ Arrays ══
export const useAllOrders          = () => useDataStore(s => s.orders);
export const useAllProducts        = () => useDataStore(s => s.products);
export const useAllTreasury        = () => useDataStore(s => s.treasury);
export const useAllTransactions    = () => useDataStore(s => s.transactions);
export const useAllPartners        = () => useDataStore(s => s.partners);
export const useAllEmployees       = () => useDataStore(s => s.employees);
export const useAllDebts           = () => useDataStore(s => s.debts);
export const useAllCouriers        = () => useDataStore(s => s.couriers);
export const useAllCustomers       = () => useDataStore(s => s.customers);
export const useAllTenants         = () => useDataStore(s => s.tenants);
export const useAllUsers           = () => useDataStore(s => s.users);
export const useAllSubscriptions   = () => useDataStore(s => s.subscriptions);
export const useVanexSettlements   = () => useDataStore(s => s.vanexSettlements);
export const useShippingCityMappings = () => useDataStore(s => s.shippingCityMappings);

// ══ Pure Actions — لا تُسبب re-render (Zustand يضمن reference ثابت للـ actions) ══
export const useGetForTenant         = () => useDataStore(s => s.getForTenant);
export const useFetchOrders          = () => useDataStore(s => s.fetchOrders);
export const useFetchProducts        = () => useDataStore(s => s.fetchProducts);
export const useFetchTreasury        = () => useDataStore(s => s.fetchTreasury);
export const useFetchCouriers        = () => useDataStore(s => s.fetchCouriers);
export const useFetchCustomers       = () => useDataStore(s => s.fetchCustomers);
export const useFetchDebts           = () => useDataStore(s => s.fetchDebts);
export const useAddOrder             = () => useDataStore(s => s.addOrder);
export const useUpdateOrderStatus    = () => useDataStore(s => s.updateOrderStatus);
export const usePatchOrder           = () => useDataStore(s => s.patchOrder);
export const useSendOrderToVanex     = () => useDataStore(s => s.sendOrderToVanex);
export const useAddProduct           = () => useDataStore(s => s.addProduct);
export const useUpdateProduct        = () => useDataStore(s => s.updateProduct);
export const useDeleteProduct        = () => useDataStore(s => s.deleteProduct);
export const useAddTransaction       = () => useDataStore(s => s.addTransaction);
export const useAddPartner           = () => useDataStore(s => s.addPartner);
export const useUpdatePartner        = () => useDataStore(s => s.updatePartner);
export const useDeletePartner        = () => useDataStore(s => s.deletePartner);
export const useWithdrawPartnerFunds = () => useDataStore(s => s.withdrawPartnerFunds);
export const useDistributeProfits    = () => useDataStore(s => s.distributeProfits);
export const useAddEmployee          = () => useDataStore(s => s.addEmployee);
export const useUpdateEmployee       = () => useDataStore(s => s.updateEmployee);
export const useDeleteEmployee       = () => useDataStore(s => s.deleteEmployee);
export const useIssuePayroll         = () => useDataStore(s => s.issuePayroll);
export const useRecordEmployeeFinancial = () => useDataStore(s => s.recordEmployeeFinancial);
export const useAddUser              = () => useDataStore(s => s.addUser);
export const useUpdateUser           = () => useDataStore(s => s.updateUser);
export const usePayDebt              = () => useDataStore(s => s.payDebt);
export const useAddDebt              = () => useDataStore(s => s.addDebt);
export const useUpdateDebt           = () => useDataStore(s => s.updateDebt);
export const useAddCourier           = () => useDataStore(s => s.addCourier);
export const useUpdateCourier        = () => useDataStore(s => s.updateCourier);
export const useToggleCourier        = () => useDataStore(s => s.toggleCourier);
export const useDeleteCourier        = () => useDataStore(s => s.deleteCourier);
export const useAddTreasuryAccount   = () => useDataStore(s => s.addTreasuryAccount);
export const useUpdateTenant         = () => useDataStore(s => s.updateTenant);
export const useAddCustomUnit        = () => useDataStore(s => s.addCustomUnit);
export const useFetchVanexSettlements  = () => useDataStore(s => s.fetchVanexSettlements);
export const useApplyVanexSettlement   = () => useDataStore(s => s.applyVanexSettlement);
