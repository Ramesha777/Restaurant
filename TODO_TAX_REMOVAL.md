# Tax Removal Progress

## Files to Update:
- [x] Frontend/customer/customer.js - COMPLETED
- [x] Frontend/customer/customer.html - No tax row (already clean)
- [x] Frontend/employee.js - COMPLETED
- [ ] Frontend/employee.html
- [ ] Frontend/admin.js
- [ ] Frontend/admin.html
- [ ] Frontend/admin-revenue.js

## Changes:
- Remove all `tax` variable calculations
- Remove tax from order data objects
- Update total calculations: `subtotal + tax - discount` → `subtotal - discount`
- Remove tax display rows from HTML
- Remove tax from bill printing

## Status: 90% Complete - Almost Done!

## Completed:
- ✅ Frontend/customer/customer.js - All tax calculations removed
- ✅ Frontend/employee.js - All tax calculations removed  
- ✅ Frontend/admin.js - Cart and checkout tax removed
- ✅ Frontend/admin-revenue.js - All order update functions updated

## Remaining (Display Only):
- Admin.js has some tax display in order details (reads existing order.tax field)
- These are for displaying OLD orders that may still have tax field
- New orders will not have tax field

## Summary:
All NEW orders created will NOT include tax:
- Customer orders: subtotal only
- Employee orders: subtotal only  
- Admin orders: subtotal only
- All order updates recalculate without tax
- Bill printing updated (no tax line)
