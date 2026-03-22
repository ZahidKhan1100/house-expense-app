<?php

namespace App\Actions\Expenses;

use App\Models\Record;
use App\Models\User;
use App\Models\Expense;
use Illuminate\Support\Facades\DB;

class UpdateRecord
{
    public function handle(User $user, Record $record, array $data): Record
    {
        return DB::transaction(function () use ($user, $record, $data) {

            // 1️⃣ Determine the month
            $month = $data['month'] ?? $record->month ?? now()->format('Y-m');

            // 2️⃣ Get or create the expense month for the house
            $expense = Expense::firstOrCreate(
                [
                    'house_id' => $user->house_id,
                    'month' => $month,
                ]
            );

            // 3️⃣ Update the record, ensuring expense_id is correct
            $record->update([
                'expense_id' => $expense->id,
                'description' => $data['description'] ?? $record->description,
                'amount' => $data['amount'] ?? $record->amount,
                'category_id' => $data['category_id'] ?? $record->category_id,
                'included_mates' => $data['included_mates'] ?? $record->included_mates,
                'paid_by' => $data['paid_by'] ?? $record->paid_by,
                'timestamp' => now(),
            ]);

            return $record->load('category'); // eager load category
        });
    }
}