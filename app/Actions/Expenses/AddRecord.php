<?php

namespace App\Actions\Expenses;

use App\Models\Record;
use App\Models\User;
use App\Models\Expense;
use Illuminate\Support\Facades\DB;

class AddRecord
{
    public function handle(User $user, array $data): Record
    {
        return DB::transaction(function () use ($user, $data) {

            // Get or create the current expense month
            $expense = Expense::firstOrCreate(
                [
                    'house_id' => $user->house_id,
                    'month' => $data['month'] ?? now()->format('Y-m'),
                ]
            );

            // Create the record
            $record = Record::create([
                'expense_id' => $expense->id,
                'added_by' => $user->id,
                'description' => $data['description'],
                'amount' => $data['amount'],
                'category_id' => $data['category_id'] ?? null,
                'included_mates' => $data['included_mates'] ?? [],
                'paid_by' => $data['paid_by'],
                'timestamp' => now(),
            ]);

            return $record->load('category'); // eager load category
        });
    }
}