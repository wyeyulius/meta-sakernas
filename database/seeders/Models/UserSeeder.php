<?php
namespace Database\Seeders\Models;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class UserSeeder extends Seeder
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
         * artisan seed:generate --model-mode --models=User
         *
         */

        
        $newData0 = \App\Models\User::create([
            'name' => 'Admin',
            'email' => 'admin@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '00',
            'status' => '3',
        ]);
        $newData1 = \App\Models\User::create([
            'name' => 'PML 7101',
            'email' => 'pml7101@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '01',
            'status' => '1',
        ]);
        $newData2 = \App\Models\User::create([
            'name' => 'PML 7102',
            'email' => 'pml7102@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '02',
            'status' => '1',
        ]);
        $newData3 = \App\Models\User::create([
            'name' => 'PML 7103',
            'email' => 'pml7103@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '03',
            'status' => '1',
        ]);
        $newData4 = \App\Models\User::create([
            'name' => 'PML 7104',
            'email' => 'pml7104@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '04',
            'status' => '1',
        ]);
        $newData5 = \App\Models\User::create([
            'name' => 'PML 7105',
            'email' => 'pml7105@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '05',
            'status' => '1',
        ]);
        $newData6 = \App\Models\User::create([
            'name' => 'PML 7106',
            'email' => 'pml7106@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '06',
            'status' => '1',
        ]);
        $newData7 = \App\Models\User::create([
            'name' => 'PML 7107',
            'email' => 'pml7107@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '07',
            'status' => '1',
        ]);
        $newData8 = \App\Models\User::create([
            'name' => 'PML 7108',
            'email' => 'pml7108@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '08',
            'status' => '1',
        ]);
        $newData9 = \App\Models\User::create([
            'name' => 'PML 7109',
            'email' => 'pml7109@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '09',
            'status' => '1',
        ]);
        $newData10 = \App\Models\User::create([
            'name' => 'PML 7110',
            'email' => 'pml7110@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '10',
            'status' => '1',
        ]);
        $newData11 = \App\Models\User::create([
            'name' => 'PML 7111',
            'email' => 'pml7111@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '11',
            'status' => '1',
        ]);
        $newData12 = \App\Models\User::create([
            'name' => 'PML 7171',
            'email' => 'pml7171@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '71',
            'status' => '1',
        ]);
        $newData13 = \App\Models\User::create([
            'name' => 'PML 7172',
            'email' => 'pml7172@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '72',
            'status' => '1',
        ]);
        $newData14 = \App\Models\User::create([
            'name' => 'PML 7173',
            'email' => 'pml7173@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '73',
            'status' => '1',
        ]);
        $newData15 = \App\Models\User::create([
            'name' => 'PML 7174',
            'email' => 'pml7174@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '74',
            'status' => '1',
        ]);
        $newData16 = \App\Models\User::create([
            'name' => 'PCL 7101',
            'email' => 'pcl7101@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '01',
            'status' => '2',
        ]);
        $newData17 = \App\Models\User::create([
            'name' => 'PCL 7102',
            'email' => 'pcl7102@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '03',
            'status' => '2',
        ]);
        $newData18 = \App\Models\User::create([
            'name' => 'PCL 7103',
            'email' => 'pcl7103@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '03',
            'status' => '2',
        ]);
        $newData19 = \App\Models\User::create([
            'name' => 'PCL 7104',
            'email' => 'pcl7104@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '04',
            'status' => '2',
        ]);
        $newData20 = \App\Models\User::create([
            'name' => 'PCL 7105',
            'email' => 'pcl7105@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '05',
            'status' => '2',
        ]);
        $newData21 = \App\Models\User::create([
            'name' => 'PCL 7106',
            'email' => 'pcl7106@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '07',
            'status' => '2',
        ]);
        $newData22 = \App\Models\User::create([
            'name' => 'PCL 7107',
            'email' => 'pcl7107@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '07',
            'status' => '2',
        ]);
        $newData23 = \App\Models\User::create([
            'name' => 'PCL 7108',
            'email' => 'pcl7108@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '08',
            'status' => '2',
        ]);
        $newData24 = \App\Models\User::create([
            'name' => 'PCL 7109',
            'email' => 'pcl7109@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '09',
            'status' => '2',
        ]);
        $newData25 = \App\Models\User::create([
            'name' => 'PCL 7110',
            'email' => 'pcl7110@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '10',
            'status' => '2',
        ]);
        $newData26 = \App\Models\User::create([
            'name' => 'PCL 7111',
            'email' => 'pcl711@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '11',
            'status' => '2',
        ]);
        $newData27 = \App\Models\User::create([
            'name' => 'PCL 7171',
            'email' => 'pcl7171@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '71',
            'status' => '2',
        ]);
        $newData28 = \App\Models\User::create([
            'name' => 'PCL 7172',
            'email' => 'pcl7172@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '72',
            'status' => '2',
        ]);
        $newData29 = \App\Models\User::create([
            'name' => 'PCL 7173',
            'email' => 'pcl7173@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '73',
            'status' => '2',
        ]);
        $newData30 = \App\Models\User::create([
            'name' => 'PCL 7174',
            'email' => 'pcl7174@monitoringbps.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'),
            'kabupaten' => '74',
            'status' => '2',
        ]);
    }
}