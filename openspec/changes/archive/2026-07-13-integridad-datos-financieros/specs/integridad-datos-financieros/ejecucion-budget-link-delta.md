# Delta for Ejecucion Budget Link

## ADDED Requirements

### Requirement: Cascade Deletion — Budget Reintegration

Cuando se borra una ejecución con `budgetLinks` mediante `deleteEjecucion`, el sistema SHALL restaurar los montos al presupuesto correspondiente y eliminar la entrada de `linkedEjecuciones`. Este reintegro SHALL ejecutarse dentro de un `writeBatch` atómico.

#### Scenario: Budget reintegrated on delete

- GIVEN una ejecución con un budgetLink a Budget A por $300k
- WHEN `deleteEjecucion` es llamada
- THEN `Budget A.totalEjecutado` decrementa en $300k
- AND el ID de la ejecución es removido de `Budget A.linkedEjecuciones`
- AND ambas operaciones se ejecutan en el mismo `writeBatch`
- AND si el batch falla, la ejecución NO es borrada (rollback implícito)

#### Scenario: Multiple budget reintegration

- GIVEN una ejecución con budgetLinks a Budget A ($200k) y Budget B ($400k)
- WHEN `deleteEjecucion` es llamada
- THEN ambos budgets son actualizados atómicamente
- AND los montos reintegrados coinciden con el `monto` de cada link
- AND `linkedEjecuciones` es actualizada en ambos budgets
