<?php
namespace Database\Seeders\Models;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ResponseSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        /**
         * Command :
         * artisan seed:generate --model-mode --models=Response
         *
         */

        
        $newData0 = \App\Models\Response::create([
            'id' => 69,
            'region_id' => 30,
            'pcl' => 'SHERYL JESSICA TATONTOS',
            'pml' => 'ANASTASYA WOWOMPANSING',
            'nurt' => 2,
            'no_art' => 1,
            'nama_art' => 'Ponamon',
            'umur' => 15,
            'r6a' => 2,
            'r8a' => 4,
            'r8b' => 5,
            'r8c' => 1,
            'r8d' => 5,
            'r8e' => 1,
            'r8f' => 5,
            'r9a' => 2,
            'r9b' => 2,
            'r9c' => 2,
            'r10' => 2,
            'konfirmasir10' => NULL,
            'r12a' => NULL,
            'r12b' => NULL,
            'r12c' => NULL,
            'r13a' => NULL,
            'kbli' => NULL,
            'kbji' => NULL,
            'r16a' => NULL,
            'r16b' => NULL,
            'r25a' => NULL,
            'r37a' => 1,
            'r37b' => 2,
            'konfirmasir37' => NULL,
            'r41a' => NULL,
            'konfirmasi' => NULL,
            'r44a' => 2,
            'r49d' => 4,
            'docState' => 'C',
            'submit_status' => 2,
            'updated_at' => '2024-07-17',
            'created_at' => '2024-07-17',
        ]);
    }
}