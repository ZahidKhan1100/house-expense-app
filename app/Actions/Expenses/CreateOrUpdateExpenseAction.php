<?php

namespace App\Actions\Expenses;

use App\Models\Expense;
use App\Models\Settlement;
use Illuminate\Support\Facades\DB;

class CreateOrUpdateExpenseAction
{
    public function execute(array $data, ?Expense $expense = null): Expense
    {
        return DB::transaction(function () use ($data, $expense) {
            $expense = $expense ? tap($expense)->update($data) : Expense::create($data);

            // Delete old settlements if editing
            if ($expense->wasRecentlyCreated === false) {
                Settlement::where('expense_id', $expense->id)->delete();
            }

            // Generate settlements if paid_by is set
            if (!empty($data['paid_by'])) {
                $amountPerMate = $expense->amount / count($data['included_mates']);
                foreach ($data['included_mates'] as $mateId) {
                    // Skip payer
                    if ($mateId == $data['paid_by']) continue;

                    Settlement::create([
                        'expense_id' => $expense->id,
                        'from_user_id' => $mateId,
                        'to_user_id' => $data['paid_by'],
                        'amount' => $amountPerMate,
                    ]);
                }
            }

            return $expense;
        });
    }
}