<?php

namespace App\Actions\Settlement;

use App\Models\Settlement;
use App\Models\Expense;
use Illuminate\Support\Facades\DB;

class CreateSettlementAction
{
    /**
     * Handle settlement creation
     *
     * @param array $data
     * @return Settlement
     */
    public function execute(array $data): Settlement
    {
        // Optional expense validation
        if (!empty($data['expense_id'])) {
            $expense = Expense::find($data['expense_id']);
            if (!$expense) {
                throw new \Exception('Expense not found');
            }

            $includedIds = $expense->included_mates->pluck('id')->toArray();

            if (!in_array($data['from_user_id'], $includedIds) || !in_array($data['to_user_id'], $includedIds)) {
                throw new \Exception('One or both users are not part of this expense');
            }
        }

        // Use transaction to prevent race conditions
        return DB::transaction(function () use ($data) {
            return Settlement::create([
                'from_user_id' => $data['from_user_id'],
                'to_user_id' => $data['to_user_id'],
                'amount' => $data['amount'],
                'status' => 'completed',
                'expense_id' => $data['expense_id'] ?? null,
            ]);
        });
    }
}